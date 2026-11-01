import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import express, { type Request } from 'express';
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose';

// No real credentials or database are needed to authenticate a signed token.
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';
process.env.JWT_TTL_SECONDS = '900';
const { issueAccessToken, verifyAccessToken } = await import('../src/modules/auth/jwt.js');
const { authenticate, cookieName, signIn, signOut } = await import('../src/modules/auth/auth.js');
const { pool } = await import('../src/db/pool.js');
const key = Buffer.from(process.env.JWT_SECRET, 'hex');
const user = { id: randomUUID(), email: 'guest@example.test', fullName: 'Test Guest' };

function signed(overrides: Record<string, unknown> = {}, header = { alg: 'HS256', typ: 'JWT' }, signingKey = key) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: user.id, email: user.email, name: user.fullName,
    iat: now, exp: now + 900, jti: randomUUID(),
    iss: 'test-issuer', aud: 'test-audience', ...overrides,
  }).setProtectedHeader(header).sign(signingKey);
}

test('issued JWTs authenticate identity with a bounded lifetime and no permissions', async () => {
  const token = await issueAccessToken(user);
  assert.deepEqual(await verifyAccessToken(token.value), { user, expiresAt: token.expiresAt });
  assert.deepEqual(decodeProtectedHeader(token.value), { alg: 'HS256', typ: 'JWT' });
  const payload = decodeJwt(token.value);
  assert.equal(payload.exp! - payload.iat!, 900);
  assert.equal(payload.role, undefined);
  assert.equal(payload.memberships, undefined);
  assert.notEqual((await issueAccessToken(user)).value, token.value);
});

test('forged identities, foreign signing keys, and unsigned tokens are rejected', async () => {
  const token = await issueAccessToken(user);
  const parts = token.value.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(token.value), sub: randomUUID(), role: 'owner' })).toString('base64url');
  assert.equal(await verifyAccessToken(parts.join('.')), null);
  assert.equal(await verifyAccessToken(await signed({}, undefined, randomBytes(32))), null);
  const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${parts[1]}.`;
  assert.equal(await verifyAccessToken(unsigned), null);
  assert.equal(await verifyAccessToken(await signed({}, { alg: 'HS384', typ: 'JWT' }, randomBytes(48))), null);
});

test('tokens must target this issuer, audience, and token type', async () => {
  for (const claims of [{ iss: 'another-api' }, { aud: 'another-app' }, { iss: undefined }, { aud: undefined }]) {
    assert.equal(await verifyAccessToken(await signed(claims)), null);
  }
  assert.equal(await verifyAccessToken(await signed({}, { alg: 'HS256', typ: 'refresh' })), null);
});

test('expired, future-dated, and excessively long-lived tokens are rejected', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const claims of [
    { iat: now - 901, exp: now - 1 }, { iat: now - 900, exp: now },
    { iat: now + 60, exp: now + 900 }, { nbf: now + 60 },
    { exp: now + 3600 }, { iat: now - 901, exp: now + 60 },
  ]) assert.equal(await verifyAccessToken(await signed(claims)), null);
});

test('missing or invalid identity and time claims fail closed', async () => {
  for (const field of ['sub', 'email', 'name', 'iat', 'exp', 'jti']) {
    assert.equal(await verifyAccessToken(await signed({ [field]: undefined })), null, field);
  }
  for (const claims of [{ sub: 'not-a-uuid' }, { email: 42 }, { email: 'invalid' }, { name: '' }, { jti: 'invalid' }, { exp: 'tomorrow' }]) {
    assert.equal(await verifyAccessToken(await signed(claims)), null);
  }
  for (const value of ['', 'a'.repeat(64), 'invalid.jwt.value', 'a'.repeat(4097)]) {
    assert.equal(await verifyAccessToken(value), null);
  }
});

test('cookie authentication needs no database or session storage', async t => {
  t.mock.method(pool, 'query', () => { throw new Error('Database unavailable'); });
  const token = await issueAccessToken(user);
  const request = (cookie?: string) => ({ headers: { cookie } }) as Request;
  assert.deepEqual(await authenticate(request(`unrelated=1; ${cookieName}=${token.value}`)), { user, expiresAt: token.expiresAt });
  assert.equal(await authenticate(request()), null);
  assert.equal(await authenticate(request(`__Host-pramod_session=${'a'.repeat(64)}`)), null);
  assert.equal(await authenticate(request(`${cookieName}=${token.value}; ${cookieName}=${token.value}`)), null);
});

test('production cookies are protected and logout only clears browser credentials', async t => {
  t.mock.method(pool, 'query', () => { throw new Error('Database unavailable'); });
  const app = express();
  app.post('/login', async (_request, response) => response.json({ expiresAt: await signIn(user, response) }));
  app.post('/logout', (_request, response) => { signOut(response); response.json({ signedIn: false }); });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${base}/login`, { method: 'POST' });
  const cookies = login.headers.getSetCookie();
  const credential = cookies.find(value => value.startsWith('__Host-pramod_access='))!;
  assert.match(credential, /; Path=\//);
  assert.match(credential, /; Secure/);
  assert.match(credential, /; HttpOnly/);
  assert.match(credential, /; SameSite=Lax/);
  assert.doesNotMatch(credential, /Domain=/);
  const raw = credential.split(';')[0]!.split('=')[1]!;
  const payload = await login.json() as { expiresAt: string };
  assert.match(credential, new RegExp(`Expires=${new Date(payload.expiresAt).toUTCString()}`));
  const logout = await fetch(`${base}/logout`, { method: 'POST', headers: { Cookie: credential.split(';')[0]! } });
  const cleared = logout.headers.getSetCookie();
  assert.ok(cleared.some(value => value.startsWith('__Host-pramod_access=;')));
  assert.ok(cleared.some(value => value.startsWith('__Host-pramod_session=;')));
  assert.ok(cleared.every(value => value.includes('Expires=Thu, 01 Jan 1970')));
  assert.deepEqual((await verifyAccessToken(raw))?.user, user);
});

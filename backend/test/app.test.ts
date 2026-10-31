import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { createApp } from '../src/app.js';

type Dependencies = NonNullable<Parameters<typeof createApp>[0]>;

async function serve(t: TestContext, overrides: Partial<Dependencies> = {}) {
  const app = createApp({
    checkDatabase: async () => {},
    getCatalog: async () => null,
    ...overrides,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

test('liveness stays healthy during a database outage', async (t) => {
  const url = await serve(t, { checkDatabase: async () => { throw new Error('offline'); } });
  const response = await fetch(`${url}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'hotel-api' });
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('readiness returns 503 when the database is unavailable without leaking details', async (t) => {
  const url = await serve(t, { checkDatabase: async () => { throw new Error('private connection details'); } });
  const response = await fetch(`${url}/api/ready`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'unavailable', database: 'disconnected' });
});

test('readiness returns 200 once the database check succeeds', async (t) => {
  const url = await serve(t);
  const response = await fetch(`${url}/api/ready`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
});

test('missing properties return a useful 404', async (t) => {
  const url = await serve(t);
  const response = await fetch(`${url}/api/properties/missing-hotel`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Property not found.' });
});

test('malformed property slugs are rejected before querying the database', async (t) => {
  let queried = false;
  const url = await serve(t, { getCatalog: async () => { queried = true; return null; } });
  const response = await fetch(`${url}/api/properties/${encodeURIComponent("hotel' OR 1=1")}`);
  assert.equal(response.status, 400);
  assert.equal(queried, false);
});

test('unexpected repository failures return JSON without exposing database internals', async (t) => {
  t.mock.method(console, 'error', () => {});
  const url = await serve(t, { getCatalog: async () => { throw new Error('private database details'); } });
  const response = await fetch(`${url}/api/properties/demo-hotel`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'An unexpected server error occurred.' });
});

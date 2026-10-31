import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true });
if (process.env.NODE_ENV === 'production') throw new Error('Integration tests must not run against a production configuration.');
if (!process.env.DATABASE_URL) throw new Error('Configure a local DATABASE_URL before running integration tests.');
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const schema = `hotel_test_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^hotel_test_[a-f0-9]{32}$/);
await admin.query(`CREATE SCHEMA "${schema}"`);
const isolatedUrl = new URL(process.env.DATABASE_URL);
isolatedUrl.searchParams.set('options', `-c search_path=${schema},public`);
process.env.DATABASE_URL = isolatedUrl.toString();
process.env.NODE_ENV = 'test';

const { pool } = await import('../src/db/pool.js');
const { createApp } = await import('../src/app.js');
const { digest } = await import('../src/modules/auth/security.js');
const origin = new URL(process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').origin;
const password = 'A long local test passphrase!';
type ResponseData = Record<string, any>;

test('PostgreSQL integration: accounts, hotel permissions, and reservation integrity', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  });
  await once(server, 'listening');
  for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) {
    await pool.query(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  async function call(path: string, body?: unknown, cookie = '', options: { origin?: string; omitOrigin?: boolean } = {}) {
    const response = await fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', ...(options.omitOrigin ? {} : { Origin: options.origin ?? origin }) }),
      ...(cookie ? { Cookie: cookie } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, headers: response.headers, payload: await response.json() as ResponseData,
      cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '' };
  }
  async function register(name: string) {
    const result = await call('/auth/register', { fullName: name, email: `${name.toLowerCase()}@example.test`, password });
    assert.equal(result.status, 201, JSON.stringify(result.payload));
    return { id: result.payload.data.user.id as string, email: result.payload.data.user.email as string, cookie: result.cookie };
  }
  const owner = await register('Owner');
  const customer = await register('Customer');
  const receptionist = await register('Receptionist');
  const outsider = await register('Outsider');
  const hotel = (await pool.query<{ id: string }>("INSERT INTO properties(slug, name) VALUES ('integration-hotel', 'Integration Hotel') RETURNING id")).rows[0]!.id;
  const otherHotel = (await pool.query<{ id: string }>("INSERT INTO properties(slug, name) VALUES ('other-hotel', 'Other Hotel') RETURNING id")).rows[0]!.id;
  await pool.query("INSERT INTO staff_memberships(property_id, user_id, role) VALUES ($1, $2, 'owner'), ($3, $4, 'owner')", [hotel, owner.id, otherHotel, outsider.id]);
  const roomType = (await pool.query<{ id: string }>("INSERT INTO room_types(property_id, name, max_guests, nightly_rate_minor) VALUES ($1, 'Test Suite', 2, 450000) RETURNING id", [hotel])).rows[0]!.id;
  const room = (await pool.query<{ id: string }>("INSERT INTO rooms(property_id, room_type_id, number) VALUES ($1, $2, '101') RETURNING id", [hotel, roomType])).rows[0]!.id;
  const { hotelToday } = await import('../src/modules/bookings/stay.js');
  const today = hotelToday('Asia/Kolkata');
  const future = (offset: number) => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10);
  const stay = { checkIn: future(5), checkOut: future(7), guests: 2 };
  const body = (overrides: Record<string, unknown> = {}) => ({ ...stay, roomTypeId: roomType, expectedTotalMinor: 900000, currency: 'INR', idempotencyKey: randomUUID(), ...overrides });
  const bookingPath = `/properties/${hotel}/bookings`;
  const staffPath = `/properties/${hotel}/staff`;

  await t.test('registration never grants a role; cookies and stored credentials are protected', async () => {
    const denied = await call('/auth/register', { fullName: 'Elevated', email: 'elevated@example.test', password, role: 'owner' });
    assert.equal(denied.status, 400);
    assert.equal((await call('/auth/register', { fullName: 'Short', email: 'short@example.test', password: 'short' })).status, 400);
    const info = await call('/auth/me', undefined, customer.cookie);
    assert.deepEqual(info.payload.data.memberships, []);
    const stored = await pool.query('SELECT password_hash FROM users WHERE id = $1', [customer.id]);
    assert.ok(stored.rows[0].password_hash.startsWith('scrypt-v1:'));
    assert.notEqual(stored.rows[0].password_hash, password);
    const sessions = await pool.query('SELECT token_hash FROM sessions WHERE user_id = $1', [customer.id]);
    assert.equal(sessions.rows[0].token_hash, digest(customer.cookie.split('=')[1]!));
    const login = await call('/auth/login', { email: customer.email, password });
    assert.match(login.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(login.headers.get('set-cookie')!, /SameSite=Lax/);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    assert.equal((await call('/auth/login', { email: customer.email, password: 'incorrect password' })).status, 401);
    assert.equal((await call('/auth/register', { fullName: 'Duplicate', email: customer.email.toUpperCase(), password })).status, 409);
  });

  await t.test('cross-origin and missing-origin writes are rejected; anonymous data stays private', async () => {
    assert.equal((await call('/auth/logout', {}, customer.cookie, { origin: 'https://attacker.example' })).status, 403);
    assert.equal((await call('/auth/logout', {}, customer.cookie, { omitOrigin: true })).status, 403);
    assert.equal((await call('/bookings')).status, 401);
    assert.equal((await call(bookingPath, body())).status, 401);
    assert.equal((await call(`${staffPath}/team`, undefined, customer.cookie)).status, 403);
    assert.equal((await call(`${staffPath}/team`, undefined, outsider.cookie)).status, 403);
  });

  await t.test('reception access stays pending until an owner approves it', async () => {
    const request = await call(`${staffPath}/requests`, { introduction: 'I work at the reception desk.' }, receptionist.cookie);
    assert.equal(request.status, 201);
    assert.equal((await call(`${staffPath}/requests`, { introduction: 'Duplicate request.' }, receptionist.cookie)).status, 409);
    const review = `${staffPath}/requests/${request.payload.data.id}/review`;
    assert.equal((await call(review, { decision: 'approved' }, receptionist.cookie)).status, 403);
    assert.equal((await call(review, { decision: 'approved' }, outsider.cookie)).status, 403);
    assert.equal((await call(review, { decision: 'approved' }, owner.cookie)).status, 200);
    assert.equal((await call(bookingPath, undefined, receptionist.cookie)).status, 200);
    assert.equal((await call(`${staffPath}/invitations`, { email: customer.email, role: 'owner' }, receptionist.cookie)).status, 403);
  });

  await t.test('invitations are email-bound, expiring, and single-use; the final owner is protected', async () => {
    const invitation = await call(`${staffPath}/invitations`, { email: customer.email, role: 'owner' }, owner.cookie);
    assert.equal(invitation.status, 201);
    const code = invitation.payload.data.token as string;
    assert.equal((await call(`${staffPath}/invitations/accept`, { code }, outsider.cookie)).status, 400);
    await pool.query("UPDATE staff_invitations SET expires_at = now() - interval '1 second' WHERE token_hash = $1", [digest(code)]);
    assert.equal((await call(`${staffPath}/invitations/accept`, { code }, customer.cookie)).status, 400);
    await pool.query("UPDATE staff_invitations SET expires_at = now() + interval '1 day' WHERE token_hash = $1", [digest(code)]);
    assert.equal((await call(`${staffPath}/invitations/accept`, { code }, customer.cookie)).status, 200);
    assert.equal((await call(`${staffPath}/invitations/accept`, { code }, customer.cookie)).status, 400);
    assert.equal((await call(`${staffPath}/members/${customer.id}/revoke`, {}, owner.cookie)).status, 200);
    assert.equal((await call(`${staffPath}/team`, undefined, customer.cookie)).status, 403);
    assert.equal((await call(`${staffPath}/members/${owner.id}/revoke`, {}, owner.cookie)).status, 409);
    // A former owner requesting reception access must not regain owner privileges.
    const request = await call(`${staffPath}/requests`, { introduction: 'Rejoining as a receptionist.' }, customer.cookie);
    assert.equal((await call(`${staffPath}/requests/${request.payload.data.id}/review`, { decision: 'approved' }, owner.cookie)).status, 200);
    assert.equal((await call(`${staffPath}/access`, undefined, customer.cookie)).payload.data.role, 'receptionist');
    await call(`${staffPath}/members/${customer.id}/revoke`, {}, owner.cookie);
  });

  await t.test('calendar dates, capacity, ownership fields, and server prices are validated', async () => {
    assert.equal((await call(bookingPath, body({ checkIn: '2027-02-30' }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ checkIn: '2020-01-01' }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ checkOut: stay.checkIn }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ checkOut: future(50) }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ guests: 3 }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ customerId: owner.id }), customer.cookie)).status, 400);
    assert.equal((await call(bookingPath, body({ expectedTotalMinor: 1 }), customer.cookie)).status, 409);
    assert.equal((await call(bookingPath, body({ currency: 'USD' }), customer.cookie)).status, 409);
    assert.equal((await call(`/properties/${otherHotel}/bookings`, body(), customer.cookie)).status, 404);
  });

  let winningBooking = '';
  await t.test('simultaneous requests cannot double-book; repeated requests return the original', async () => {
    const first = body(); const second = body();
    const responses = await Promise.all([call(bookingPath, first, customer.cookie), call(bookingPath, second, customer.cookie)]);
    assert.deepEqual(responses.map(result => result.status).sort(), [201, 409]);
    const winnerIndex = responses.findIndex(result => result.status === 201);
    const winner = responses[winnerIndex]!;
    winningBooking = winner.payload.data.id;
    const winnerBody = winnerIndex === 0 ? first : second;
    const repeat = await call(bookingPath, winnerBody, customer.cookie);
    assert.equal(repeat.status, 200); assert.equal(repeat.payload.data.id, winningBooking);
    assert.equal((await call(bookingPath, { ...winnerBody, guests: 1 }, customer.cookie)).status, 409);
    const query = new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: '2' });
    const available = await call(`/properties/${hotel}/availability?${query}`);
    assert.equal(available.payload.data.roomTypes[0].availableRooms, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM notification_outbox WHERE booking_id = $1', [winningBooking])).rows[0].n, 1);
  });

  await t.test('database exclusion and tenant foreign keys protect writes outside the API', async () => {
    await assert.rejects(pool.query('UPDATE bookings SET total_minor = total_minor + 1 WHERE id = $1', [winningBooking]), (error: any) => error.code === '23514');
    const secondId = randomUUID();
    await pool.query(`INSERT INTO bookings(id, property_id, customer_id, room_type_id, check_in, check_out, guests, nightly_rate_minor, total_minor, currency, idempotency_key, request_hash)
      VALUES ($1, $2, $3, $4, $5, $6, 1, 450000, 900000, 'INR', $7, 'test')`, [secondId, hotel, customer.id, roomType, stay.checkIn, stay.checkOut, randomUUID()]);
    await assert.rejects(pool.query('INSERT INTO booking_rooms(booking_id, property_id, room_id, check_in, check_out) VALUES ($1, $2, $3, $4, $5)', [secondId, hotel, room, stay.checkIn, stay.checkOut]), (error: any) => error.code === '23P01');
    await assert.rejects(pool.query('INSERT INTO rooms(property_id, room_type_id, number) VALUES ($1, $2, $3)', [otherHotel, roomType, 'cross-hotel']), (error: any) => error.code === '23503');
    await pool.query('DELETE FROM bookings WHERE id = $1', [secondId]);
  });

  await t.test('customer and staff access is scoped; cancellation releases inventory atomically', async () => {
    assert.equal((await call(`/bookings/${winningBooking}/cancel`, {}, outsider.cookie)).status, 404);
    assert.equal((await call(`/properties/${otherHotel}/bookings/${winningBooking}/cancel`, {}, outsider.cookie)).status, 404);
    assert.equal((await call('/bookings', undefined, outsider.cookie)).payload.data.length, 0);
    assert.equal((await call(`/bookings/${winningBooking}/cancel`, {}, customer.cookie)).status, 200);
    assert.equal((await call(`/bookings/${winningBooking}/cancel`, {}, customer.cookie)).status, 200);
    assert.equal((await pool.query('SELECT active FROM booking_rooms WHERE booking_id = $1', [winningBooking])).rows[0].active, false);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM notification_outbox WHERE booking_id = $1', [winningBooking])).rows[0].n, 2);
    assert.equal((await call(bookingPath, body(), customer.cookie)).status, 201);
    assert.equal((await call(bookingPath, body({ checkIn: future(7), checkOut: future(9) }), customer.cookie)).status, 201);
  });

  await t.test('check-in/out transitions enforce dates and room readiness', async () => {
    const created = await call(bookingPath, body({ checkIn: today, checkOut: future(1), expectedTotalMinor: 450000 }), customer.cookie);
    assert.equal(created.status, 201);
    const path = `${bookingPath}/${created.payload.data.id}`;
    assert.equal((await call(`${path}/check-in`, {}, customer.cookie)).status, 403);
    assert.equal((await call(`${path}/check-out`, {}, receptionist.cookie)).status, 409);
    assert.equal((await call(`${staffPath}/rooms/${room}/housekeeping`, { status: 'dirty' }, receptionist.cookie)).status, 200);
    assert.equal((await call(`${path}/check-in`, {}, receptionist.cookie)).status, 409);
    await call(`${staffPath}/rooms/${room}/housekeeping`, { status: 'clean' }, receptionist.cookie);
    assert.equal((await call(`${path}/check-in`, {}, receptionist.cookie)).status, 200);
    assert.equal((await call(`/bookings/${created.payload.data.id}/cancel`, {}, customer.cookie)).status, 409);
    assert.equal((await call(`${path}/check-out`, {}, receptionist.cookie)).status, 200);
    assert.equal((await pool.query('SELECT housekeeping_status FROM rooms WHERE id = $1', [room])).rows[0].housekeeping_status, 'dirty');
    await call(`${staffPath}/members/${receptionist.id}/revoke`, {}, owner.cookie);
    assert.equal((await call(bookingPath, undefined, receptionist.cookie)).status, 403);
  });

  await t.test('expired sessions and signed-out sessions cannot be reused; rate limits are shared', async () => {
    const login = await call('/auth/login', { email: customer.email, password });
    assert.equal(login.status, 200);
    await call('/auth/logout', {}, login.cookie);
    assert.equal((await call('/bookings', undefined, login.cookie)).status, 401);
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1", [outsider.id]);
    assert.equal((await call('/bookings', undefined, outsider.cookie)).status, 401);
    await pool.query("INSERT INTO rate_limits(key, attempts, resets_at) VALUES ($1, 10, now() + interval '1 hour') ON CONFLICT (key) DO UPDATE SET attempts = 10, resets_at = EXCLUDED.resets_at", [digest(`login-email:${customer.email}`)]);
    const limited = await call('/auth/login', { email: customer.email, password });
    assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'));
  });
});

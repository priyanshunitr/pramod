import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test, type TestContext } from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
const { attachSpeechServer } = await import('../src/modules/speech/speech.server.js');
const { issueAccessToken } = await import('../src/modules/auth/jwt.js');
const { cookieName } = await import('../src/modules/auth/auth.js');
const { HttpError, allowedOrigins } = await import('../src/lib/http.js');
const origin = [...allowedOrigins][0]!;
const propertyId = randomUUID();
const user = { id: randomUUID(), email: 'staff@example.test', fullName: 'Speech Tester' };
const credentials = `${cookieName}=${(await issueAccessToken(user)).value}`;

type Message = { type: string; text?: string; message?: string; isFinal?: boolean };
function client(url: string, cookie = credentials, source: string | undefined = origin) {
  const socket = new WebSocket(url, { headers: { Cookie: cookie, ...(source ? { Origin: source } : {}) } });
  const messages: Message[] = [];
  socket.on('error', () => {});
  socket.on('message', raw => { messages.push(JSON.parse(raw.toString())); });
  async function next(type: string) {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const message = messages.find(message => message.type === type);
      if (message) return message;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(`No ${type} message received: ${JSON.stringify(messages)}`);
  }
  return { socket, messages, next };
}

async function serve(t: TestContext, options: { rejectedStatus?: number; durationMs?: number; accessCheckMs?: number } = {}) {
  const providerHttp = createServer();
  const provider = new WebSocketServer({ noServer: true });
  let providerConnections = 0, audio = 0, stops = 0, allowed = true, requests = 0;
  providerHttp.on('upgrade', (request, socket, head) => {
    if (options.rejectedStatus) { socket.end(`HTTP/1.1 ${options.rejectedStatus} Rejected\r\nContent-Length: 0\r\n\r\n`); return; }
    provider.handleUpgrade(request, socket, head, ws => {
      providerConnections++;
      ws.on('message', (data, binary) => {
        if (binary) {
          audio += Array.isArray(data) ? data.reduce((sum, part) => sum + part.length, 0) : data instanceof ArrayBuffer ? data.byteLength : data.length;
          ws.send(JSON.stringify({ type: 'Results', is_final: false, start: 0, duration: 1, channel: { alternatives: [{ transcript: 'Aditi' }] } }));
        } else if (JSON.parse(data.toString()).type === 'CloseStream') {
          stops++;
          ws.send(JSON.stringify({ type: 'Results', is_final: true, start: 0, duration: 2, channel: { alternatives: [{ transcript: 'Aditi Sen.' }] } }));
          ws.close(1000);
        }
      });
    });
  });
  providerHttp.listen(0, '127.0.0.1'); await once(providerHttp, 'listening');
  const upstreamAddress = providerHttp.address(); assert.ok(upstreamAddress && typeof upstreamAddress !== 'string');
  const server = createServer((_request, response) => { response.writeHead(404).end(); });
  const dispose = attachSpeechServer(server, {
    authorize: async (hotel, id) => { if (!allowed || hotel !== propertyId || id !== user.id) throw new HttpError(403, 'Denied'); },
    throttle: async () => { requests++; if (requests > 10) throw new HttpError(429, 'Too many recordings'); },
    configured: () => true,
    connect: () => new WebSocket(`ws://127.0.0.1:${upstreamAddress.port}`),
    durationMs: options.durationMs ?? 120_000, accessCheckMs: options.accessCheckMs ?? 15_000,
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => {
    dispose(); provider.clients.forEach(ws => ws.terminate()); provider.close();
    await Promise.all([server, providerHttp].map(server => new Promise<void>(done => server.close(() => done()))));
  });
  return { url: `ws://127.0.0.1:${address.port}/api/properties/${propertyId}/staff/speech`,
    revoke: () => { allowed = false; }, stats: () => ({ providerConnections, audio, stops }) };
}

async function rejected(url: string, cookie: string, source: string | undefined) {
  const ws = new WebSocket(url, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...(source ? { Origin: source } : {}) } });
  ws.on('error', () => {});
  const status = await new Promise<number | undefined>((resolve, reject) => {
    ws.on('unexpected-response', (_request, response) => { response.resume(); resolve(response.statusCode); ws.terminate(); });
    ws.on('open', () => { ws.terminate(); reject(new Error('Unexpected authorization success')); });
  });
  return status;
}

test('speech rejects anonymous, forged, foreign-origin, wrong-hotel and unapproved connections before contacting Deepgram', async t => {
  const f = await serve(t);
  assert.equal(await rejected(f.url, '', origin), 401);
  assert.equal(await rejected(f.url, `${cookieName}=invalid`, origin), 401);
  assert.equal(await rejected(f.url, credentials, 'https://untrusted.example'), 403);
  assert.equal(await rejected(f.url, credentials, undefined), 403);
  assert.equal(await rejected(f.url.replace(propertyId, randomUUID()), credentials, origin), 403);
  f.revoke(); assert.equal(await rejected(f.url, credentials, origin), 403);
  assert.equal(f.stats().providerConnections, 0);
});

test('authorized speech streams partial and final text, drains on Stop, and permits only one active recording per user', async t => {
  const f = await serve(t); const c = client(f.url); await c.next('Ready');
  assert.equal(await rejected(f.url, credentials, origin), 429);
  c.socket.send(Buffer.from('synthetic audio'));
  assert.equal((await c.next('Transcript')).text, 'Aditi');
  c.socket.send('{"type":"Stop"}'); await c.next('Complete');
  assert.equal(c.messages.filter(message => message.type === 'Transcript').at(-1)?.text, 'Aditi Sen.');
  assert.equal(f.stats().audio, 15); assert.equal(f.stats().stops, 1);
  assert.equal(JSON.stringify(c.messages).includes('access_token'), false);
});

test('Deepgram billing errors are actionable without exposing provider response bodies or credentials', async t => {
  const f = await serve(t, { rejectedStatus: 402 }); const c = client(f.url);
  assert.match((await c.next('Error')).message!, /credits or billing/);
  assert.equal(c.messages.some(message => message.type === 'Ready'), false);
});

test('revoked access stops an active stream and prevents further audio', async t => {
  const f = await serve(t, { accessCheckMs: 20 }); const c = client(f.url); await c.next('Ready');
  f.revoke(); assert.match((await c.next('Error')).message!, /access could not be verified/);
});

test('recording duration is bounded and unsupported client control messages are rejected', async t => {
  const f = await serve(t, { durationMs: 40 }); const c = client(f.url); await c.next('Ready');
  await c.next('StopRecording'); c.socket.send('{"type":"Stop"}'); await c.next('Complete');
  const next = client(f.url); await next.next('Ready'); next.socket.send('{"type":"Configure","model":"other"}');
  assert.match((await next.next('Error')).message!, /Unsupported/);
});

import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { env } from '../../config/env.js';
import { allowedOrigins, HttpError, uuid } from '../../lib/http.js';
import { authenticate } from '../auth/auth.js';
import { rateLimit } from '../auth/security.js';
import { requireRole } from '../staff/permissions.js';

interface Dependencies {
  authenticate: typeof authenticate;
  authorize: (propertyId: string, userId: string) => Promise<unknown>;
  throttle: (key: string, limit: number, seconds: number) => Promise<void>;
  configured: () => boolean;
  connect: () => WebSocket;
  durationMs: number;
  accessCheckMs: number;
}
const defaults: Dependencies = {
  authenticate, authorize: requireRole, throttle: rateLimit,
  configured: () => Boolean(env.DEEPGRAM_API_KEY), durationMs: 120_000, accessCheckMs: 15_000,
  connect: () => new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&interim_results=true&smart_format=true&endpointing=300', {
    headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}` }, handshakeTimeout: 12_000,
    maxPayload: 256 * 1024, perMessageDeflate: false,
  }),
};

function reject(socket: Duplex, status: number) {
  if (!socket.destroyed && !socket.writableEnded) socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

// Audio exists only in the active socket. No recordings, transcripts, or keys are persisted.
export function attachSpeechServer(server: Server, overrides: Partial<Dependencies> = {}) {
  const deps = { ...defaults, ...overrides };
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024, perMessageDeflate: false });
  const active = new Map<string, WebSocket>();
  let shuttingDown = false;
  const onUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const match = /^\/api\/properties\/([^/?]+)\/staff\/speech$/.exec(request.url ?? '');
    if (!match || !uuid.safeParse(match[1]).success) return reject(socket, 404);
    if (!request.headers.origin || !allowedOrigins.has(request.headers.origin)) return reject(socket, 403);
    const connectionError = () => {};
    socket.on('error', connectionError);
    const deadline = setTimeout(() => reject(socket, 503), 10_000);
    try {
      const identity = await deps.authenticate(request);
      if (!identity) throw new HttpError(401, 'Sign in to continue.');
      await deps.authorize(match[1]!, identity.user.id);
      if (!deps.configured()) throw new HttpError(503, 'Speech is not configured.');
      await deps.throttle(`speech:${identity.user.id}`, 10, 900);
      if (socket.destroyed || socket.writableEnded || shuttingDown) return;
      if (active.has(identity.user.id)) throw new HttpError(429, 'A recording is already active.');
      sockets.handleUpgrade(request, socket, head, client => {
        active.set(identity.user.id, client);
        bridge(client, match[1]!, identity.user.id, Date.parse(identity.expiresAt));
      });
    } catch (cause) { reject(socket, cause instanceof HttpError ? cause.status : 503); }
    finally { clearTimeout(deadline); socket.removeListener('error', connectionError); }
  };

  function bridge(client: WebSocket, propertyId: string, userId: string, expiresAt: number) {
    let upstream: WebSocket | undefined;
    let closed = false, ready = false, finishing = false, checking = false, alive = true;
    let bytes = 0;
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const intervals = new Set<ReturnType<typeof setInterval>>();
    const later = (fn: () => void, delay: number) => { const timer = setTimeout(fn, delay); timeouts.add(timer); return timer; };
    const repeat = (fn: () => void, delay: number) => { intervals.add(setInterval(fn, delay)); };
    const send = (data: unknown) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data)); };
    const cleanup = () => {
      if (closed) return; closed = true;
      timeouts.forEach(clearTimeout); intervals.forEach(clearInterval);
      if (active.get(userId) === client) active.delete(userId);
      if (upstream && upstream.readyState !== WebSocket.CLOSED) upstream.terminate();
    };
    const fail = (message: string) => {
      if (closed) return;
      send({ type: 'Error', message }); client.close(1011, 'Speech ended'); cleanup();
    };
    const finish = () => {
      if (closed || finishing) return;
      if (!ready || upstream?.readyState !== WebSocket.OPEN) return fail('The speech connection was interrupted. Please try again.');
      finishing = true;
      upstream.send(JSON.stringify({ type: 'CloseStream' }));
      later(() => fail('The last words could not be confirmed. Your existing text is still available.'), 10_000);
    };
    client.on('close', cleanup);
    client.on('error', cleanup);
    client.on('pong', () => { alive = true; });
    client.on('message', (data, binary) => {
      if (closed || finishing) return;
      if (!binary) {
        if (data.toString() === '{"type":"Stop"}') finish();
        else fail('Unsupported recording message.');
        return;
      }
      bytes += Array.isArray(data) ? data.reduce((sum, part) => sum + part.length, 0) : data instanceof ArrayBuffer ? data.byteLength : data.length;
      if (bytes > 8 * 1024 * 1024) return fail('Recording is too large. Start a shorter recording.');
      if (!ready || upstream?.readyState !== WebSocket.OPEN) return fail('The speech service is not ready. Please try again.');
      if (upstream.bufferedAmount > 1024 * 1024) return fail('The connection is too slow to transcribe. Please try again.');
      upstream.send(data, { binary: true });
    });
    const connectDeadline = later(() => fail('The speech service took too long to connect. Please try again.'), 15_000);
    later(() => fail('Your sign-in has expired. Sign in again to continue recording.'), Math.max(1, expiresAt - Date.now()));
    repeat(() => {
      if (!alive) { client.terminate(); cleanup(); return; }
      alive = false; client.ping();
    }, 20_000);
    repeat(() => {
      if (closed || checking) return;
      checking = true;
      void deps.authorize(propertyId, userId).catch(() => fail('Reception access could not be verified. Please sign in again.')).finally(() => { checking = false; });
    }, deps.accessCheckMs);
    try { upstream = deps.connect(); }
    catch { fail('Could not connect to the speech service. Please try again.'); return; }
    upstream.on('unexpected-response', (_request, response) => {
      response.resume();
      fail(response.statusCode === 402 ? 'Deepgram credits or billing need attention. Contact the hotel setup team.'
        : response.statusCode === 401 || response.statusCode === 403 ? 'The speech service credentials were rejected. Contact the hotel setup team.'
        : response.statusCode === 429 ? 'The speech service is busy. Please try again shortly.' : 'The speech service is unavailable. Please try again.');
    });
    upstream.on('error', () => fail('Could not connect to the speech service. Please try again.'));
    upstream.on('open', () => {
      if (closed) return upstream?.terminate();
      clearTimeout(connectDeadline); ready = true;
      send({ type: 'Ready', maxSeconds: Math.floor(deps.durationMs / 1000) });
      later(() => { send({ type: 'StopRecording' }); later(finish, 2000); }, deps.durationMs);
      repeat(() => { if (!finishing && upstream?.readyState === WebSocket.OPEN) upstream.send(JSON.stringify({ type: 'KeepAlive' })); }, 4000);
    });
    upstream.on('message', (raw, binary) => {
      if (closed || binary) return;
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'Error') return fail('Speech could not be transcribed. Please try again.');
        const text = data.channel?.alternatives?.[0]?.transcript;
        if (data.type !== 'Results' || typeof text !== 'string' || typeof data.is_final !== 'boolean') return;
        if (text.length > 20_000 || client.bufferedAmount > 1024 * 1024) return fail('The transcript connection is too slow. Please try again.');
        send({ type: 'Transcript', text, isFinal: data.is_final, id: `${data.start}:${data.duration}` });
      } catch { fail('The speech service returned an invalid response. Please try again.'); }
    });
    upstream.on('close', code => {
      if (closed) return;
      if (!finishing || code !== 1000) return fail('The speech connection ended unexpectedly. Your existing text is still available.');
      send({ type: 'Complete' }); client.close(1000); cleanup();
    });
  }
  server.on('upgrade', onUpgrade);
  return () => {
    shuttingDown = true; server.off('upgrade', onUpgrade);
    sockets.clients.forEach(client => client.terminate());
    sockets.close();
  };
}

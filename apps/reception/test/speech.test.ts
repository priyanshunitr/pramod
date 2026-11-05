import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpeechCapture, Transcript, type SpeechState } from '../src/speech.ts';

function fixture() {
  const states: SpeechState[] = [], texts: string[] = [], errors: string[] = [], sent: unknown[] = [];
  const track = { stopped: false, onended: null as (() => void) | null, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const socket = { readyState: 1, bufferedAmount: 0, onmessage: null as ((event: { data: string }) => void) | null,
    onclose: null as (() => void) | null, onerror: null as (() => void) | null,
    close() { this.readyState = 3; }, send(data: unknown) { sent.push(data); } };
  const recorder = { state: 'inactive', ondataavailable: null as ((event: { data: Blob }) => void) | null,
    onstop: null as (() => void) | null, onerror: null as (() => void) | null,
    start() { this.state = 'recording'; }, stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['last-audio']) }); this.onstop?.(); } };
  const events = { state: (value: SpeechState) => states.push(value), text: (value: string) => texts.push(value), error: (value: string) => errors.push(value) };
  const platform = { microphone: async () => stream, check: async () => {}, socket: () => socket as unknown as WebSocket, recorder: () => recorder as unknown as MediaRecorder };
  const capture = new SpeechCapture(platform, events);
  const message = (data: unknown) => socket.onmessage?.({ data: JSON.stringify(data) });
  return { states, texts, errors, sent, track, stream, socket, recorder, platform, events, capture, message };
}

test('interim speech replaces tentative words; final segments are retained exactly once', () => {
  const transcript = new Transcript();
  assert.equal(transcript.update('Ad', false, '0:1'), 'Ad');
  assert.equal(transcript.update('Aditi', false, '0:2'), 'Aditi');
  assert.equal(transcript.update('Aditi', true, '0:2'), 'Aditi');
  assert.equal(transcript.update('Aditi', true, '0:2'), 'Aditi');
  assert.equal(transcript.update('Sen.', false, '2:1'), 'Aditi Sen.');
  assert.equal(transcript.update('Sen.', true, '2:1'), 'Aditi Sen.');
});

test('recording starts only when ready; Stop flushes final audio before closing and releases the mic', async t => {
  const f = fixture(); t.after(() => f.capture.dispose());
  await f.capture.start(); assert.equal(f.recorder.state, 'inactive');
  f.message({ type: 'Ready' }); assert.equal(f.recorder.state, 'recording');
  f.message({ type: 'Transcript', text: '', isFinal: false, id: '0:0' });
  assert.deepEqual(f.texts, []);
  f.message({ type: 'Transcript', text: 'A', isFinal: false, id: '0:0.5' });
  f.message({ type: 'Transcript', text: '', isFinal: false, id: '0:0.5' });
  f.message({ type: 'Transcript', text: 'Aditi', isFinal: false, id: '0:1' });
  f.capture.stop(); assert.equal(f.track.stopped, true);
  assert.equal(f.states.at(-1), 'finishing');
  assert.ok(f.sent[0] instanceof Blob); assert.equal(f.sent[1], '{"type":"Stop"}');
  f.message({ type: 'Transcript', text: 'Aditi Sen.', isFinal: true, id: '0:2' });
  f.message({ type: 'Complete' });
  assert.deepEqual(f.texts, ['A', '', 'Aditi', 'Aditi Sen.']); assert.equal(f.states.at(-1), 'idle'); assert.equal(f.socket.readyState, 3);
});

test('cancelling during microphone permission prevents a late response from starting capture', async () => {
  const f = fixture(); let resolve!: (stream: MediaStream) => void; let opened = false;
  const capture = new SpeechCapture({ ...f.platform, microphone: () => new Promise(done => { resolve = done; }), socket: () => { opened = true; return f.platform.socket(); } }, f.events);
  const starting = capture.start(); capture.stop(); resolve(f.stream); await starting;
  assert.equal(f.track.stopped, true); assert.equal(opened, false); assert.equal(f.states.at(-1), 'idle');
});

test('provider failures and unmount stop recording without replacing the existing query', async () => {
  const f = fixture(); await f.capture.start(); f.message({ type: 'Ready' });
  f.message({ type: 'Error', message: 'Deepgram credits need attention.' });
  assert.equal(f.track.stopped, true); assert.equal(f.recorder.state, 'inactive'); assert.equal(f.states.at(-1), 'idle');
  assert.deepEqual(f.texts, []); assert.match(f.errors[0]!, /credits/);
  const second = fixture(); await second.capture.start(); second.message({ type: 'Ready' }); second.capture.dispose();
  second.message({ type: 'Transcript', text: 'late', isFinal: true, id: '0:1' });
  assert.equal(second.track.stopped, true); assert.deepEqual(second.texts, []);
});

test('microphone denial is actionable and does not open a speech connection', async () => {
  const f = fixture(); let opened = false;
  const capture = new SpeechCapture({ ...f.platform, microphone: async () => { throw new DOMException('denied', 'NotAllowedError'); }, socket: () => { opened = true; return f.platform.socket(); } }, f.events);
  await capture.start(); assert.match(f.errors[0]!, /Microphone access was denied/); assert.equal(opened, false); assert.equal(f.states.at(-1), 'idle');
});

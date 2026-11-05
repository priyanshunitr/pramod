export type SpeechState = 'idle' | 'connecting' | 'listening' | 'finishing';
export interface SpeechEvents {
  state: (state: SpeechState) => void;
  text: (text: string) => void;
  error: (message: string) => void;
}
export interface SpeechPlatform {
  check: (signal: AbortSignal) => Promise<unknown>;
  microphone: () => Promise<MediaStream>;
  recorder: (stream: MediaStream) => MediaRecorder;
  socket: () => WebSocket;
}

export class Transcript {
  private final = '';
  private ids = new Set<string>();
  update(text: string, isFinal: boolean, id: string): string {
    if (isFinal && !this.ids.has(id)) {
      this.ids.add(id);
      this.final = [this.final, text.trim()].filter(Boolean).join(' ');
    }
    return [this.final, isFinal ? '' : text.trim()].filter(Boolean).join(' ');
  }
}

// A capture owns its microphone, recorder, socket, and deadlines. Disposing it
// prevents late permission responses or socket events from restarting recording.
export class SpeechCapture {
  private platform: SpeechPlatform;
  private events: SpeechEvents;
  private abort = new AbortController();
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private socket?: WebSocket;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private transcript = new Transcript();
  private finished = false;
  private stopping = false;
  private started = false;
  private complete = false;
  private hasTranscript = false;
  constructor(platform: SpeechPlatform, events: SpeechEvents) { this.platform = platform; this.events = events; }
  private later(fn: () => void, delay: number) { const timer = setTimeout(fn, delay); this.timers.add(timer); return timer; }
  private fail(message: string) { if (!this.finished) { this.events.error(message); this.dispose(); } }
  private stopMicrophone() { this.stream?.getTracks().forEach(track => track.stop()); }
  async start() {
    if (this.started || this.finished) return; this.started = true;
    this.events.state('connecting');
    // Timeout also covers a microphone prompt left unanswered.
    const deadline = this.later(() => this.fail('Could not start the microphone. Check permission and try again.'), 30_000);
    try {
      const stream = await this.platform.microphone();
      if (this.finished) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      await this.platform.check(this.abort.signal);
      if (this.finished) return;
      const socket = this.platform.socket(); this.socket = socket;
      socket.onmessage = event => {
        if (this.finished) return;
        try {
          const data = JSON.parse(String(event.data));
          if (data.type === 'Error') return this.fail(typeof data.message === 'string' ? data.message : 'Speech could not be transcribed.');
          if (data.type === 'Ready' && !this.recorder && !this.stopping) {
            clearTimeout(deadline);
            const recorder = this.platform.recorder(stream); this.recorder = recorder;
            recorder.ondataavailable = event => {
              if (this.finished || !event.data.size) return;
              if (socket.readyState !== 1) return this.fail('The speech connection was lost. Please try again.');
              if (socket.bufferedAmount > 1024 * 1024) return this.fail('The connection is too slow to transcribe. Please try again.');
              socket.send(event.data);
            };
            recorder.onstop = () => {
              this.stopMicrophone();
              if (this.finished) return;
              this.stopping = true; this.events.state('finishing');
              if (socket.readyState === 1) socket.send('{"type":"Stop"}');
              else this.fail('The speech connection was lost. Your search text has been kept.');
            };
            recorder.onerror = () => this.fail('The microphone stopped working. Please try again.');
            stream.getAudioTracks().forEach(track => { track.onended = () => this.stop(); });
            recorder.start(250); this.events.state('listening');
            this.later(() => this.stop(), 119_000);
          } else if (data.type === 'Transcript' && typeof data.text === 'string' && typeof data.isFinal === 'boolean' && typeof data.id === 'string') {
            const text = this.transcript.update(data.text, data.isFinal, data.id);
            if (text || this.hasTranscript) { this.hasTranscript = true; this.events.text(text); }
          } else if (data.type === 'StopRecording') this.stop();
          else if (data.type === 'Complete') { this.complete = true; this.dispose(); }
        } catch { this.fail('The speech service returned an invalid response. Please try again.'); }
      };
      socket.onerror = () => this.fail('Could not connect to speech. Check your connection and reception access, then try again.');
      socket.onclose = () => {
        if (!this.finished && !this.complete) this.fail('The speech connection ended. Your search text has been kept.');
      };
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      this.fail(name === 'NotAllowedError' ? 'Microphone access was denied. Allow the microphone in your browser and try again.'
        : name === 'NotFoundError' ? 'No microphone was found. Connect a microphone and try again.'
        : name === 'NotReadableError' ? 'Your microphone is unavailable or in use by another app.'
        : cause instanceof Error ? cause.message : 'Could not start speech to text. Please try again.');
    }
  }
  stop() {
    if (this.finished || this.stopping) return;
    if (!this.recorder) { this.dispose(); return; }
    this.stopping = true; this.events.state('finishing');
    // stop() queues the final audio chunk before onstop sends the Stop message.
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    this.stopMicrophone();
    this.later(() => this.fail('The last words could not be confirmed. Your search text has been kept.'), 12_000);
  }
  dispose() {
    if (this.finished) return; this.finished = true;
    this.abort.abort(); this.timers.forEach(clearTimeout);
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null;
      if (this.recorder.state !== 'inactive') this.recorder.stop();
    }
    this.stopMicrophone();
    if (this.socket) {
      this.socket.onmessage = null; this.socket.onclose = null; this.socket.onerror = null;
      if (this.socket.readyState === 0 || this.socket.readyState === 1) this.socket.close();
    }
    this.events.state('idle');
  }
}

export function microphoneSupported() {
  return Boolean(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined' && typeof WebSocket !== 'undefined');
}
export function createRecorder(stream: MediaStream) {
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  return new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
}

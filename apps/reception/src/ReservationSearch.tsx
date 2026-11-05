import { useEffect, useRef, useState } from 'react';
import { Mic, Search, Square, X } from 'lucide-react';
import { useWorkspace } from '@hotel/ui';
import { createRecorder, microphoneSupported, SpeechCapture, type SpeechState } from './speech';

export function ReservationSearch({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { property, request, preview } = useWorkspace();
  const [state, setState] = useState<SpeechState>('idle');
  const [error, setError] = useState('');
  const active = useRef<SpeechCapture | null>(null);
  const busy = state !== 'idle';
  const supported = microphoneSupported();
  useEffect(() => {
    const stopWhenHidden = () => { if (document.hidden) active.current?.stop(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => { active.current?.dispose(); document.removeEventListener('visibilitychange', stopWhenHidden); };
  }, [property.id]);
  function toggle() {
    if (active.current) { active.current.stop(); return; }
    setError('');
    const capture = new SpeechCapture({
      microphone: () => navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false }),
      check: signal => request(`/properties/${property.id}/staff/speech/status`, undefined, signal),
      recorder: createRecorder,
      socket: () => new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/properties/${encodeURIComponent(property.id)}/staff/speech`),
    }, { text: onChange, error: setError, state: next => { setState(next); if (next === 'idle') active.current = null; } });
    active.current = capture; void capture.start();
  }
  return <div className="reservation-search">
    <div className={`search-field voice-search ${state === 'listening' ? 'is-listening' : ''}`}>
      <Search size={16} aria-hidden="true" /><input aria-label="Search reservations" aria-describedby="reservation-speech-help" placeholder="Guest, email, room or reference" value={value} readOnly={busy} onChange={event => onChange(event.target.value)} />
      {value && !busy && <button className="voice-clear" aria-label="Clear reservation search" onClick={() => onChange('')}><X size={14} /></button>}
      <button className="voice-button" aria-label={state === 'connecting' ? 'Cancel speech connection' : busy ? 'Stop speech to text' : 'Start speech to text'} aria-pressed={busy} title={preview ? 'Sign in with approved reception access to use speech.' : !supported ? 'Use a browser with microphone support on HTTPS or localhost.' : busy ? 'Stop recording' : 'Search by speaking'} disabled={preview || !supported || state === 'finishing'} onClick={toggle}>
        {busy ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
      </button>
    </div>
    <p className="speech-help" id="reservation-speech-help" role="status">{state === 'connecting' ? 'Connecting… You can cancel at any time.' : state === 'listening' ? 'Listening… Say a name, room number, email, or reference. Press stop when done.' : state === 'finishing' ? 'Finishing your words…' : preview ? 'Speech is available after signing in with approved reception access.' : !supported ? 'Speech needs microphone support on HTTPS or localhost.' : 'Speak to search. Audio is sent to Deepgram while recording.'}</p>
    {error && <p className="speech-error" role="alert">{error}</p>}
  </div>;
}

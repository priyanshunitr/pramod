import { useCallback, useEffect, useState } from 'react';
import { BedDouble, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useStaffRequest } from './WorkspaceContext';
import type { StaffRoom } from './preview';

const labels = { clean: 'Clean', dirty: 'Needs cleaning', cleaning: 'Cleaning' };
export function HousekeepingPanel({ propertyId }: { propertyId: string }) {
  const request = useStaffRequest();
  const [rooms, setRooms] = useState<StaffRoom[]>([]); const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [message, setMessage] = useState('');
  const base = `/properties/${propertyId}/staff/rooms`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try { const data = await request<StaffRoom[]>(base, undefined, signal); if (!signal?.aborted) setRooms(data); }
    catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load rooms.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [base, request]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function update(room: StaffRoom, value: string) {
    setBusy(room.id); setError(null); setMessage('');
    try { await request(`${base}/${room.id}/housekeeping`, { status: value }); await load(); setMessage(`Room ${room.number} marked ${labels[value as keyof typeof labels].toLowerCase()}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update room status.'); }
    finally { setBusy(null); }
  }
  const visible = rooms.filter(room => (status === 'all' || room.housekeepingStatus === status) && room.number.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="workspace-section page-enter"><div className="portal-page-heading"><div><p className="eyebrow">THE DETAILS MAKE THE DIFFERENCE</p><h1>Ready for the <em>next arrival.</em></h1><p>Room condition, at a glance. Check-out automatically marks a room for cleaning.</p></div><button className="button secondary" disabled={loading || !!busy} onClick={() => { void load(); }}><RefreshCw size={14} />Refresh</button></div>
    <div className="section-toolbar"><div className="filter-tabs" aria-label="Room condition">{(['all', 'clean', 'dirty', 'cleaning'] as const).map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === 'all' ? 'All rooms' : labels[value]}<span>{rooms.filter(room => value === 'all' || room.housekeepingStatus === value).length}</span></button>)}</div><label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search room number" aria-label="Search room readiness" /></label></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {loading && !rooms.length ? <p className="fine-print" role="status">Loading room readiness…</p> : <div className="room-ready-grid">{visible.map(room => <article className={`room-ready-card ${room.housekeepingStatus}`} key={room.id}><div className="room-ready-top"><BedDouble size={21} strokeWidth={1.4} /><span className="ready-tag">{labels[room.housekeepingStatus]}</span></div><h3>Room {room.number}</h3><p>{room.operationalStatus === 'active' ? 'In service' : 'Out of service · not bookable'}</p><label>Room condition<select aria-label={`Room ${room.number} housekeeping`} value={room.housekeepingStatus} disabled={!!busy || loading} onChange={event => { void update(room, event.target.value); }}><option value="clean">Clean</option><option value="dirty">Needs cleaning</option><option value="cleaning">Cleaning in progress</option></select></label></article>)}</div>}
    {!loading && !visible.length && !error && <div className="empty-state"><Sparkles size={26} /><h3>{rooms.length ? 'No rooms match this view.' : 'No rooms configured yet.'}</h3><p>{rooms.length ? 'Choose another condition or room number.' : 'Rooms will appear here when they are added to the hotel.'}</p></div>}
  </section>;
}

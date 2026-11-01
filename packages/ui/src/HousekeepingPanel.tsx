import { useEffect, useState } from 'react';
import { useStaffRequest } from './WorkspaceContext';

interface Room { id: string; number: string; housekeepingStatus: string; operationalStatus: string; }
export function HousekeepingPanel({ propertyId }: { propertyId: string }) {
  const api = useStaffRequest();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/properties/${propertyId}/staff/rooms`;
  useEffect(() => {
    const controller = new AbortController();
    api<Room[]>(base, undefined, controller.signal).then(data => { if (!controller.signal.aborted) { setRooms(data); setError(null); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load rooms.'); });
    return () => controller.abort();
  }, [base, version, api]);
  async function update(id: string, status: string) {
    setBusy(true); setError(null);
    try { await api(`${base}/${id}/housekeeping`, { status }); setVersion(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not update room status.'); }
    finally { setBusy(false); }
  }
  return <section className="workspace-section"><div className="workspace-heading"><h2>Room <em>readiness.</em></h2><button className="text-link" disabled={busy} onClick={() => setVersion(value => value + 1)}>Refresh rooms</button></div><p>Check-out marks a room dirty. Confirm it is clean before the next check-in.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="readiness-grid">{rooms.map(room => <label className="team-card" key={room.id}><strong>Room {room.number}</strong><span>{room.operationalStatus === 'active' ? 'In service' : 'Out of service'}</span><select aria-label={`Room ${room.number} housekeeping`} value={room.housekeepingStatus} disabled={busy} onChange={event => update(room.id, event.target.value)}><option value="clean">Clean</option><option value="dirty">Dirty</option><option value="cleaning">Cleaning</option></select></label>)}</div></section>;
}

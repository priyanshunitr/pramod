import { useEffect, useState } from 'react';
import { api, type Booking } from '@hotel/api-client';
import { formatMoney, prettyDate } from './format';

const statusLabels = { confirmed: 'Confirmed', checked_in: 'Checked in', checked_out: 'Checked out', cancelled: 'Cancelled' };
export function BookingList({ propertyId, items, onChange }: { propertyId?: string; items?: Booking[]; onChange?: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const base = propertyId ? `/properties/${propertyId}/bookings` : '/bookings';
  useEffect(() => {
    if (items) { setBookings(items); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError(null);
    api<Booking[]>(base, undefined, controller.signal).then(data => { if (!controller.signal.aborted) setBookings(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load reservations.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, version, items]);
  async function update(id: string, action: string) {
    setBusy(id); setError(null);
    try { await api(`${base}/${id}/${action}`, {}); setConfirmCancel(null); setVersion(value => value + 1); onChange?.(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not update the reservation.'); }
    finally { setBusy(null); }
  }
  return <div className="booking-list">
    <div className="workspace-toolbar"><p>{items ? `${items.length} matching reservations` : 'Up to 100 recent reservations'} · no online payments collected</p><button className="text-link" disabled={loading || Boolean(busy)} onClick={() => { setVersion(value => value + 1); onChange?.(); }}>Refresh</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading reservations…</p> : !bookings.length && !error ? <div className="empty-state"><h3>No reservations yet.</h3><p>Your confirmed stays will appear here.</p></div> : bookings.map(booking => <article className="reservation-card" key={booking.id}>
      <div className="reservation-top"><div><span className={`status-badge ${booking.status}`}>{statusLabels[booking.status]}</span><h3>{booking.roomTypeName}</h3><p>{prettyDate(booking.checkIn)} – {prettyDate(booking.checkOut)} · {booking.guests} guests</p>{propertyId && <p>{booking.customerName} · {booking.customerEmail} · Room {booking.roomNumber}</p>}<small className="booking-reference">Reference: {booking.id}</small></div><strong>{formatMoney(booking.totalMinor / 100, booking.currency)}</strong></div>
      <div className="reservation-actions">{booking.status === 'confirmed' && (confirmCancel === booking.id ? <><span>Cancel this reservation and release the room?</span><button className="button secondary" disabled={Boolean(busy)} onClick={() => update(booking.id, 'cancel')}>Yes, cancel reservation</button><button className="text-link" onClick={() => setConfirmCancel(null)}>Keep reservation</button></> : <button className="text-link" disabled={Boolean(busy)} onClick={() => setConfirmCancel(booking.id)}>Cancel reservation</button>)}
        {propertyId && booking.status === 'confirmed' && <button className="button secondary" disabled={Boolean(busy)} onClick={() => update(booking.id, 'check-in')}>Check in</button>}
        {propertyId && booking.status === 'checked_in' && <button className="button secondary" disabled={Boolean(busy)} onClick={() => update(booking.id, 'check-out')}>Check out</button>}
        {busy === booking.id && <span role="status">Updating…</span>}
      </div>
    </article>)}
  </div>;
}

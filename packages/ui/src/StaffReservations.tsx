import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, X } from 'lucide-react';
import type { Booking } from '@hotel/contracts';
import { formatMoney, prettyDate } from './format';
import { useWorkspace } from './WorkspaceContext';

const labels = { confirmed: 'Confirmed', checked_in: 'In house', checked_out: 'Checked out', cancelled: 'Cancelled' };
export function StaffReservations({ items, today, onChange, compact = false, empty = 'No reservations match this view.' }: {
  items: Booking[]; today: string; onChange: () => void | Promise<void>; compact?: boolean; empty?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const booking = items.find(item => item.id === selected);
  return <>
    {items.length ? <div className="staff-table-scroll"><table className="staff-table"><thead><tr><th>Guest</th><th>Stay</th><th>Room</th><th>Status</th>{!compact && <th>Stay value</th>}<th><span className="sr-only">Reservation details</span></th></tr></thead><tbody>{items.map(item => <tr key={item.id}>
      <td><div className="guest-cell"><span className="guest-initials" aria-hidden="true">{(item.customerName || 'Guest').split(' ').map(word => word[0]).slice(0, 2).join('')}</span><div><strong>{item.customerName || 'Guest'}</strong><small>{item.id.slice(0, 12).toUpperCase()}</small></div></div></td>
      <td>{prettyDate(item.checkIn)} — {prettyDate(item.checkOut)}<small>{item.guests} {item.guests === 1 ? 'guest' : 'guests'}</small></td>
      <td>{item.roomNumber}<small>{item.roomTypeName}</small></td><td><span className={`status-badge ${item.status}`}>{labels[item.status]}</span></td>
      {!compact && <td>{formatMoney(item.totalMinor / 100, item.currency)}</td>}<td><button className="text-link" onClick={() => setSelected(item.id)} aria-label={`View reservation for ${item.customerName || 'guest'}, room ${item.roomNumber}`}>View <ArrowUpRight size={13} /></button></td>
    </tr>)}</tbody></table></div> : <div className="staff-empty"><CalendarDays size={26} /><h3>{empty}</h3><p>Try another view or search for a different guest.</p></div>}
    {booking && <ReservationDetails key={booking.id} booking={booking} today={today} close={() => setSelected(null)} onChange={onChange} />}
  </>;
}

function ReservationDetails({ booking, today, close, onChange }: { booking: Booking; today: string; close: () => void; onChange: () => void | Promise<void> }) {
  const { request, property } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); const [cancel, setCancel] = useState(false);
  const previousStatus = useRef(booking.status);
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => { element.close(); }; }, []);
  useEffect(() => {
    if (previousStatus.current !== booking.status) {
      previousStatus.current = booking.status;
      dialog.current?.querySelector<HTMLButtonElement>('.dialog-heading button')?.focus();
    }
  }, [booking.status]);
  useEffect(() => { if (cancel) dialog.current?.querySelector<HTMLButtonElement>('.notice .reservation-actions button')?.focus(); }, [cancel]);
  async function act(action: 'check-in' | 'check-out' | 'cancel') {
    setBusy(true); setError(null); setMessage(null);
    try {
      await request(`/properties/${property.id}/bookings/${booking.id}/${action}`, {});
      setCancel(false); await onChange();
      setMessage(action === 'check-in' ? 'Guest checked in. Welcome to Pramod.' : action === 'check-out' ? 'Guest checked out. The room is now marked for cleaning.' : 'Reservation cancelled and its room released.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this reservation.'); }
    finally { setBusy(false); }
  }
  const canCheckIn = booking.status === 'confirmed' && booking.checkIn <= today && booking.checkOut > today;
  return <dialog ref={dialog} className="workspace-dialog" aria-labelledby="reservation-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="dialog-heading"><div><p className="eyebrow">RESERVATION DETAILS</p><h2 id="reservation-title">{booking.customerName || 'Guest stay'}</h2></div><button className="icon-button" aria-label="Close reservation details" disabled={busy} onClick={close}><X size={21} /></button></div>
    <div className="dialog-body"><span className={`status-badge ${booking.status}`}>{labels[booking.status]}</span><dl className="detail-grid"><div><dt>Check-in</dt><dd>{prettyDate(booking.checkIn)}</dd></div><div><dt>Check-out</dt><dd>{prettyDate(booking.checkOut)}</dd></div><div><dt>Room</dt><dd>{booking.roomNumber} · {booking.roomTypeName}</dd></div><div><dt>Guests</dt><dd>{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</dd></div><div className="detail-wide"><dt>Email</dt><dd>{booking.customerEmail || 'Not provided'}</dd></div><div className="detail-wide"><dt>Reference</dt><dd>{booking.id}</dd></div></dl>
      <div className="dialog-total"><span>Agreed stay value</span><strong>{formatMoney(booking.totalMinor / 100, booking.currency)}</strong></div><p className="fine-print">{formatMoney(booking.nightlyRateMinor / 100, booking.currency)} per night. No payment collection is recorded here.</p>
      {booking.status === 'confirmed' && <p className="fine-print">{canCheckIn ? 'Check-in requires a clean, vacant room in service.' : booking.checkIn > today ? 'Check-in becomes available on the arrival date.' : 'This stay’s check-in window has passed.'}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      <div className="reservation-actions">{canCheckIn && <button className="button primary" disabled={busy} onClick={() => act('check-in')}>Check in guest <ArrowUpRight size={15} /></button>}{booking.status === 'checked_in' && <button className="button primary" disabled={busy} onClick={() => act('check-out')}>Check out guest <ArrowUpRight size={15} /></button>}{booking.status === 'confirmed' && !cancel && <button className="text-link" disabled={busy} onClick={() => { setCancel(true); setMessage(null); }}>Cancel reservation</button>}{busy && <span role="status">Updating…</span>}</div>
      {cancel && <div className="notice"><strong>Cancel this reservation?</strong><p>The assigned room will be released for other guests.</p><div className="reservation-actions"><button className="button secondary" disabled={busy} onClick={() => act('cancel')}>Confirm cancellation</button><button className="text-link" disabled={busy} onClick={() => setCancel(false)}>Keep reservation</button></div></div>}
    </div>
  </dialog>;
}

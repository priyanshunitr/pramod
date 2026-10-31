import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { api, type Booking } from '../lib/api';
import { useAvailability } from '../lib/useAvailability';
import { formatMoney } from '../config/hotel';
import { stayQuery, type StayPlan } from '../lib/stay';

export function BookingPanel({ propertyId, plan }: { propertyId: string; plan: StayPlan }) {
  const auth = useAuth();
  const availability = useAvailability(propertyId, plan);
  const quote = availability.data?.roomTypes.find(room => room.id === plan.roomId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallbackKey] = useState(() => crypto.randomUUID());

  async function reserve() {
    if (!quote || !auth.user || !availability.data) return;
    setBusy(true); setError(null);
    const fingerprint = JSON.stringify([auth.user.id, propertyId, plan, quote.totalMinor, availability.data.currency]);
    let idempotencyKey: string = fallbackKey;
    try {
      const stored = JSON.parse(sessionStorage.getItem('pramod.booking-request') ?? 'null') as { fingerprint: string; key: string } | null;
      idempotencyKey = stored?.fingerprint === fingerprint ? stored.key : crypto.randomUUID();
      sessionStorage.setItem('pramod.booking-request', JSON.stringify({ fingerprint, key: idempotencyKey }));
    } catch { /* The in-memory key still protects retries when browser storage is disabled. */ }
    try {
      const result = await api<Booking>(`/properties/${propertyId}/bookings`, {
        roomTypeId: plan.roomId, checkIn: plan.checkIn, checkOut: plan.checkOut, guests: plan.guests,
        expectedTotalMinor: quote.totalMinor, currency: availability.data.currency, idempotencyKey,
      });
      setBooking(result);
      try { sessionStorage.removeItem('pramod.booking-request'); } catch { /* Optional local cleanup. */ }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not reserve this stay. You can safely retry.'); }
    finally { setBusy(false); }
  }

  if (booking) return <div className="booking-success" role="status"><span className={`status-badge ${booking.status}`}>{booking.status === 'confirmed' ? 'Reservation confirmed' : booking.status.replaceAll('_', ' ')}</span><h3>{booking.status === 'cancelled' ? 'This reservation was cancelled.' : <>Your stay is <em>saved.</em></>}</h3><p>Reference: <span className="booking-reference">{booking.id}</span></p><p>No payment has been collected. View your account for the current reservation details.</p><Link to="/account" className="button primary full-width">View my reservations</Link></div>;
  if (availability.loading) return <p role="status">Checking rooms and current prices…</p>;
  if (availability.error) return <div className="form-error" role="alert">{availability.error}<button className="text-link" onClick={availability.refresh}>Try again</button></div>;
  if (!quote || quote.availableRooms < 1) return <div className="quiet-note"><strong>These dates aren’t available.</strong><p>Try another room or adjust your stay.</p><Link className="text-link" to={`/rooms?${stayQuery(plan)}`}>Find available rooms</Link><button className="text-link" onClick={availability.refresh}>Check again</button></div>;
  return <div className="booking-panel"><div className="price-breakdown"><div><span>{availability.data!.nights} nights × {formatMoney(quote.nightlyRateMinor / 100, availability.data!.currency)}</span><strong>{formatMoney(quote.totalMinor / 100, availability.data!.currency)}</strong></div><div className="estimate-total"><span>Room total</span><strong>{formatMoney(quote.totalMinor / 100, availability.data!.currency)}</strong></div></div>
    <p className="fine-print">{quote.availableRooms} {quote.availableRooms === 1 ? 'room available' : 'rooms available'} for these dates. Demo rates; taxes and online payments are not configured.</p>
    {auth.loading ? <p role="status">Checking your account…</p> : auth.user ? <button className="button primary full-width" disabled={busy} onClick={reserve}>{busy ? 'Reserving…' : 'Confirm reservation'}</button> : <Link className="button primary full-width" to={`/account?next=${encodeURIComponent(`/stay?room=${plan.roomId}&${stayQuery(plan)}`)}`}>Sign in to reserve</Link>}
    {error && <div className="form-error" role="alert">{error}<button disabled={busy} className="text-link" onClick={availability.refresh}>Refresh availability</button></div>}
    <p className="fine-print">Confirmation reserves a room. You can cancel a future reservation from your account before checking in.</p>
  </div>;
}

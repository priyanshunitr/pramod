import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowUpRight, BedDouble, CalendarDays, Check, UserRound } from 'lucide-react';
import { ApiError, type Booking, type StaffBookingAvailability, type StaffBookingInput } from '@hotel/api-client';
import { addDays, formatMoney, prettyDate, todayAtHotel } from './format';
import { useWorkspace } from './WorkspaceContext';

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const bookingStatus = { confirmed: 'Confirmed · awaiting check-in', checked_in: 'In house', checked_out: 'Checked out', cancelled: 'Cancelled' };

export function StaffBookingPage() {
  const { property, request } = useWorkspace();
  const [params] = useSearchParams();
  const today = todayAtHotel(property.timezone);
  const requestedIn = params.get('checkIn') || params.get('from') || today;
  const requestedOut = params.get('checkOut') || params.get('to') || '';
  const initialIn = validDate(requestedIn) && requestedIn >= today ? requestedIn : today;
  const [checkIn, setCheckIn] = useState(initialIn);
  const [checkOut, setCheckOut] = useState(validDate(requestedOut) && requestedOut > initialIn ? requestedOut : addDays(initialIn, 1));
  const [guests, setGuests] = useState(/^[1-6]$/.test(params.get('guests') || '') ? params.get('guests')! : '2');
  const [roomTypeId, setRoomTypeId] = useState(params.get('roomTypeId') || '');
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [quote, setQuote] = useState<StaffBookingAvailability | null>(null); const [roomId, setRoomId] = useState('');
  const [checking, setChecking] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [created, setCreated] = useState<Booking | null>(null);
  const [pending, setPending] = useState<StaffBookingInput | null>(null);
  const lookup = useRef<AbortController | null>(null);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useRef<HTMLFormElement>(null); const successHeading = useRef<HTMLHeadingElement>(null);
  const selected = quote?.rooms.find(room => room.roomId === roomId);
  const visibleRooms = quote?.rooms.filter(room => !roomTypeId || room.roomTypeId === roomTypeId) ?? [];
  const locked = busy || !!pending;
  useEffect(() => () => lookup.current?.abort(), []);
  useEffect(() => { if (created) successHeading.current?.focus(); }, [created]);

  function resetAvailability() {
    lookup.current?.abort(); setChecking(false); setQuote(null); setRoomId(''); setError('');
  }
  async function findRooms() {
    const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
    if (!checkIn || !checkOut || checkIn < today || !Number.isFinite(nights) || nights < 1 || nights > 30) {
      setError('Choose a stay of 1–30 nights, starting today or later.'); return;
    }
    resetAvailability();
    const controller = new AbortController(); lookup.current = controller; setChecking(true);
    try {
      const data = await request<StaffBookingAvailability>(`/properties/${property.id}/staff/booking-availability?${new URLSearchParams({ checkIn, checkOut, guests })}`, undefined, controller.signal);
      if (!controller.signal.aborted) setQuote(data);
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check room availability.'); }
    finally { if (!controller.signal.aborted) setChecking(false); }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    let payload = pending;
    if (!payload) {
      if (!form.current?.reportValidity()) return;
      if (fullName.trim().length < 2) { setError('Enter the guest’s full name.'); return; }
      if (!email.trim() && !phone.trim()) { setError('Add a phone number or email for the guest.'); return; }
      const digits = phone.replace(/\D/g, '');
      if (phone.trim() && (digits.length < 7 || digits.length > 15 || !/^\+?[0-9\s().-]+$/.test(phone.trim()))) {
        setError('Enter a phone number with 7–15 digits.'); return;
      }
      if (!quote || !selected) { setError('Check availability and select a room first.'); return; }
      const details = { checkIn, checkOut, guests: Number(guests), roomTypeId: selected.roomTypeId, roomId,
        expectedTotalMinor: selected.totalMinor, currency: quote.currency,
        guest: { fullName: fullName.trim(), ...(email.trim() ? { email: email.trim().toLowerCase() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) } };
      const fingerprint = JSON.stringify(details);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
      payload = { ...details, idempotencyKey: attempt.current.key };
    }
    setBusy(true); setError('');
    try {
      const booking = await request<Booking>(`/properties/${property.id}/staff/bookings`, payload);
      setPending(null); setCreated(booking);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status < 500) {
        setPending(null);
        if (cause.status === 409) { setQuote(null); setRoomId(''); }
        setError(cause.message);
      } else {
        // Keep both details and key fixed when the server may have committed.
        setPending(payload); setError('We couldn’t confirm the response. Retry confirmation to check the same reservation safely.');
      }
    } finally { setBusy(false); }
  }

  if (created) return <section className="staff-booking-success page-enter">
    <span className="booking-success-mark"><Check size={28} /></span><p className="eyebrow">A STAY TO LOOK FORWARD TO</p>
    <h1 tabIndex={-1} ref={successHeading}>{created.status === 'confirmed' ? 'Reservation confirmed.' : 'Reservation found.'}</h1><p>{created.customerName} · <strong>Room {created.roomNumber}</strong></p>
    <dl className="detail-grid"><div><dt>Check-in</dt><dd>{prettyDate(created.checkIn)}</dd></div><div><dt>Check-out</dt><dd>{prettyDate(created.checkOut)}</dd></div>
      <div><dt>Room type</dt><dd>{created.roomTypeName}</dd></div><div><dt>Guests</dt><dd>{created.guests}</dd></div>
      <div><dt>Agreed stay value</dt><dd>{formatMoney(created.totalMinor / 100, created.currency)}</dd></div><div><dt>Status</dt><dd>{bookingStatus[created.status]}</dd></div>
      <div className="detail-wide"><dt>Reference</dt><dd>{created.id}</dd></div></dl>
    <div className="booking-success-actions"><Link className="button primary" to={`/reservations?${new URLSearchParams({ from: created.checkIn, to: created.checkOut, booking: created.id, view: 'all' })}`}>View reservation <ArrowUpRight size={15} /></Link>
      <button className="button secondary" onClick={() => { setCreated(null); setFullName(''); setEmail(''); setPhone(''); resetAvailability(); attempt.current = null; }}>Book another stay</button></div>
    <p className="fine-print">No payment has been collected.{created.status === 'confirmed' && ' Check the guest in from their reservation when they arrive.'}</p>
  </section>;

  return <div className="page-enter"><div className="portal-page-heading"><div><p className="eyebrow">MAKE ROOM FOR THEIR STAY</p><h1>A warm welcome, <em>booked.</em></h1><p>Create a reservation for a guest. They don’t need an account.</p></div></div>
    <form ref={form} onSubmit={confirm} className="staff-booking-layout">
      <fieldset className="staff-booking-fields" disabled={locked}><legend className="sr-only">Guest and stay details</legend>
        <section className="staff-booking-panel"><div className="booking-section-title"><UserRound size={19} /><div><p className="eyebrow">01 / THE GUEST</p><h2>Who’s staying?</h2></div></div>
          <div className="booking-inputs"><label className="booking-full-field">Guest full name<input value={fullName} onChange={event => setFullName(event.target.value)} required minLength={2} maxLength={120} autoComplete="off" placeholder="Full name" /></label>
            <label>Phone<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} autoComplete="off" aria-describedby="guest-contact-help" placeholder="e.g. +91 98765 43210" /></label>
            <label>Email (optional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} autoComplete="off" aria-describedby="guest-contact-help" placeholder="guest@example.com" /></label></div>
          <p className="fine-print" id="guest-contact-help">Email is optional. Provide a phone number if you leave it blank.</p>
        </section>
        <section className="staff-booking-panel"><div className="booking-section-title"><CalendarDays size={19} /><div><p className="eyebrow">02 / THE STAY</p><h2>Find their room.</h2></div></div>
          <div className="booking-inputs"><label>Check-in<input type="date" required min={today} value={checkIn} onChange={event => { setCheckIn(event.target.value); resetAvailability(); }} /></label>
            <label>Check-out<input type="date" required min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} value={checkOut} onChange={event => { setCheckOut(event.target.value); resetAvailability(); }} /></label>
            <label>Guests<select value={guests} onChange={event => { setGuests(event.target.value); resetAvailability(); }}>{[1,2,3,4,5,6].map(value => <option value={value} key={value}>{value} {value === 1 ? 'guest' : 'guests'}</option>)}</select></label>
            <label>Room type<select value={roomTypeId} onChange={event => { setRoomTypeId(event.target.value); setRoomId(''); }}><option value="">All room types</option>{property.roomTypes.map(type => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label></div>
          <button type="button" className="button secondary" onClick={() => { void findRooms(); }} disabled={checking}>{checking ? 'Checking rooms…' : 'Check availability'}</button>
          {checking && <p role="status" className="fine-print">Finding rooms for the whole stay…</p>}
          {quote && <fieldset className="booking-room-options"><legend>{visibleRooms.length} {visibleRooms.length === 1 ? 'room available' : 'rooms available'} · {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}</legend>
            {visibleRooms.map(room => <label className={`booking-room-option ${roomId === room.roomId ? 'selected' : ''}`} key={room.roomId}>
              <input type="radio" name="room" value={room.roomId} checked={roomId === room.roomId} onChange={() => setRoomId(room.roomId)} /><BedDouble size={20} />
              <span><strong>Room {room.roomNumber}</strong><small>{room.roomTypeName} · Up to {room.maxGuests} guests</small></span>
              <span className="booking-room-price"><strong>{formatMoney(room.totalMinor / 100, quote.currency)}</strong><small>whole stay</small></span></label>)}
            {!visibleRooms.length && <p className="booking-no-rooms">No rooms match this stay. Try different dates, fewer guests, or another room type.</p>}
          </fieldset>}
        </section>
      </fieldset>
      <aside className="staff-booking-review"><p className="eyebrow">03 / REVIEW & CONFIRM</p><h2>Their stay, at a glance.</h2>
        <dl><div><dt>Guest</dt><dd>{fullName.trim() || 'Add guest details'}</dd></div><div><dt>Stay</dt><dd>{checkIn && checkOut ? `${prettyDate(checkIn)} — ${prettyDate(checkOut)}` : 'Choose dates'}</dd></div><div><dt>Guests</dt><dd>{guests}</dd></div>
          <div><dt>Room</dt><dd>{selected ? `${selected.roomNumber} · ${selected.roomTypeName}` : 'Select an available room'}</dd></div>
          {selected && quote && <div><dt>Nightly rate</dt><dd>{formatMoney(selected.nightlyRateMinor / 100, quote.currency)} × {quote.nights} {quote.nights === 1 ? 'night' : 'nights'}</dd></div>}</dl>
        <div className="booking-review-total"><span>Agreed stay value</span><strong>{selected && quote ? formatMoney(selected.totalMinor / 100, quote.currency) : '—'}</strong></div>
        <p className="fine-print">The room is reserved when you confirm. No payment is collected here.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={busy || (!pending && !selected)}>{busy ? 'Confirming…' : pending ? 'Retry confirmation' : 'Confirm reservation'}<ArrowUpRight size={15} /></button>
        {busy && <p className="fine-print" role="status">Creating the reservation…</p>}
      </aside>
    </form>
  </div>;
}

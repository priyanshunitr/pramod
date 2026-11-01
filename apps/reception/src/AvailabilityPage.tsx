import { useEffect, useState, type FormEvent } from 'react';
import { BedDouble, CalendarDays, Users } from 'lucide-react';
import type { Availability } from '@hotel/api-client';
import { addDays, formatMoney, prettyDate, todayAtHotel, useWorkspace } from '@hotel/ui';
import classicPhoto from './assets/classic-room.jpg';
import deluxePhoto from './assets/deluxe-room.jpg';
import suitePhoto from './assets/family-suite.jpg';
const photos: Record<string, string> = { 'Classic Room': classicPhoto, 'Deluxe Room': deluxePhoto, 'Family Suite': suitePhoto };

export function AvailabilityPage() {
  const { property, request } = useWorkspace(); const today = todayAtHotel(property.timezone);
  const [dates, setDates] = useState({ checkIn: today, checkOut: addDays(today, 1), guests: '2' });
  const [result, setResult] = useState<Availability | null>(null); const [error, setError] = useState<string | null>(null); const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  const query = new URLSearchParams(dates).toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setResult(null);
    request<Availability>(`/properties/${property.id}/availability?${query}`, undefined, controller.signal).then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not check availability.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [property.id, query, request, version]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); const checkIn = String(fields.get('checkIn')); const checkOut = String(fields.get('checkOut'));
    const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
    if (checkIn < today || !Number.isFinite(nights) || nights < 1 || nights > 30) { setFormError('Choose a stay of 1–30 nights, starting today or later.'); return; }
    setFormError(null); setDates({ checkIn, checkOut, guests: String(fields.get('guests')) }); setVersion(value => value + 1);
  }
  return <div className="page-enter"><div className="portal-page-heading"><div><p className="eyebrow">FIND THEIR PLACE AT PRAMOD</p><h1>Room for <em>a little escape.</em></h1><p>Check live room availability and the agreed rate for the whole stay.</p></div></div>
    <form className="availability-form" onSubmit={submit}><label><span><CalendarDays size={14} />Check-in</span><input type="date" name="checkIn" defaultValue={dates.checkIn} min={today} required /></label><label><span><CalendarDays size={14} />Check-out</span><input type="date" name="checkOut" defaultValue={dates.checkOut} min={addDays(today, 1)} required /></label><label><span><Users size={14} />Guests</span><select name="guests" defaultValue={dates.guests}>{[1,2,3,4,5,6].map(value => <option key={value} value={value}>{value} {value === 1 ? 'guest' : 'guests'}</option>)}</select></label><button className="button primary" disabled={loading}>Check availability</button></form>
    {formError && <p className="form-error" role="alert">{formError}</p>}{error && <div className="form-error" role="alert">{error} <button className="text-link" onClick={() => setVersion(value => value + 1)}>Try again</button></div>}
    {loading ? <p className="fine-print" role="status">Checking rooms for your dates…</p> : result && <><div className="section-toolbar"><p>{prettyDate(dates.checkIn)} — {prettyDate(dates.checkOut)} · {result.nights} {result.nights === 1 ? 'night' : 'nights'} · {dates.guests} guests</p><p>Checkout day is available for the next arrival.</p></div><div className="availability-cards">{result.roomTypes.map((type, index) => <article className="availability-card" key={type.id}><div className="availability-card-top"><span>0{index + 1}</span><>{photos[type.name] ? <img src={photos[type.name]} alt={`Illustrative ${type.name.toLowerCase()} interior`} /> : <BedDouble size={39} strokeWidth={1} />}</><span className={`status-badge ${type.availableRooms ? 'checked_in' : 'cancelled'}`}>{type.availableRooms ? `${type.availableRooms} available` : 'Fully booked'}</span></div><div className="availability-card-body"><h2>{type.name}</h2><p>Up to {type.maxGuests} guests</p><div className="availability-rate"><strong>{formatMoney(type.nightlyRateMinor / 100, result.currency)}</strong><span>/ night</span></div><div className="availability-total"><span>For {result.nights} {result.nights === 1 ? 'night' : 'nights'}</span><strong>{formatMoney(type.totalMinor / 100, result.currency)}</strong></div></div></article>)}</div>{!result.roomTypes.length && <div className="empty-state"><BedDouble size={27} /><h3>No rooms match this group size.</h3><p>Try a smaller number of guests to see room options.</p></div>}<p className="fine-print">Availability does not hold a room. Guests confirm reservations through the guest website. Room readiness is checked separately at check-in.</p></>}
  </div>;
}

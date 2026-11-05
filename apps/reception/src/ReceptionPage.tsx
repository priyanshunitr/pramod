import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, BedDouble, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import type { Booking } from '@hotel/api-client';
import { StaffReservations, todayAtHotel, prettyDate, useWorkspace, type StaffRoom } from '@hotel/ui';
import { inReservationScope, matchesReservationSearch, reservationScopes as scopes, type ReservationScope as Scope } from './filters';
import { ReservationSearch } from './ReservationSearch';

const labels: Record<Scope, string> = { arrivals: 'Arrivals', departures: 'Departures', inhouse: 'In house', all: 'All reservations', confirmed: 'Confirmed', cancelled: 'Cancelled' };
export function ReceptionPage({ dashboard = false }: { dashboard?: boolean }) {
  const { property, request } = useWorkspace(); const today = todayAtHotel(property.timezone);
  const [bookings, setBookings] = useState<Booking[]>([]); const [rooms, setRooms] = useState<StaffRoom[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams(); const [search, setSearch] = useState('');
  const selected = params.get('view') as Scope; const scope = scopes.includes(selected) ? selected : dashboard ? 'arrivals' : 'all';
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const [stays, roomData] = await Promise.all([request<Booking[]>(`/properties/${property.id}/bookings`, undefined, signal), request<StaffRoom[]>(`/properties/${property.id}/staff/rooms`, undefined, signal)]);
      if (!signal?.aborted) { setBookings(stays); setRooms(roomData); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the front desk.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [property.id, request]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const inScope = (booking: Booking, value: Scope) => inReservationScope(booking, value, today);
  const matching = bookings.filter(booking => inScope(booking, scope) && matchesReservationSearch(booking, search));
  const awaiting = bookings.filter(booking => booking.checkIn === today && booking.status === 'confirmed').length;
  const leaving = bookings.filter(booking => booking.checkOut <= today && booking.status === 'checked_in').length;
  const inhouse = bookings.filter(booking => booking.status === 'checked_in').length;
  const prepare = rooms.filter(room => room.operationalStatus === 'active' && room.housekeepingStatus !== 'clean').length;
  const filterTabs = <div className="filter-tabs" aria-label="Reservation view">{(dashboard ? scopes.slice(0, 3) : scopes).map(value => <button key={value} aria-pressed={scope === value} onClick={() => { const next = new URLSearchParams(params); next.set('view', value); setParams(next); }}>{labels[value]}<span>{bookings.filter(booking => inScope(booking, value)).length}</span></button>)}</div>;
  return <div className="page-enter">
    <div className="portal-page-heading"><div><p className="eyebrow">{dashboard ? 'THE RECEPTION DESK' : 'A PLACE FOR EVERY GUEST'}</p><h1>{dashboard ? <>A good day starts <em>here.</em></> : <>Every stay, <em>looked after.</em></>}</h1><p>{dashboard ? 'The arrivals, little details, and warm welcomes ahead.' : 'Find a guest, review their stay, and take care of the next step.'}</p></div><div className="heading-date"><span>{prettyDate(today)} · {property.timezone}</span><button className="button secondary" disabled={loading} onClick={() => { void load(); }}><RefreshCw size={14} />Refresh</button></div></div>
    {error && <div className="form-error" role="alert">{error} <button className="text-link" disabled={loading} onClick={() => { void load(); }}>Try again</button></div>}
    {loading && !bookings.length && !rooms.length ? <div className="empty-state" role="status"><p>Preparing your front desk…</p></div> : !error && <>
      {bookings.length >= 100 && <p className="notice">This view contains the 100 most recent reservations. Arrival and in-house totals refer to this list.</p>}
      {dashboard && <div className="desk-metrics"><Link className="desk-metric" to="/reservations?view=arrivals"><span>Expected arrivals <ArrowDownLeft size={17} /></span><strong>{String(awaiting).padStart(2, '0')}</strong><small>Still to check in today</small></Link><Link className="desk-metric" to="/reservations?view=departures"><span>Departures today <LogOut size={17} /></span><strong>{String(leaving).padStart(2, '0')}</strong><small>Due today or overdue</small></Link><Link className="desk-metric" to="/reservations?view=inhouse"><span>Stays in house <BedDouble size={17} /></span><strong>{String(inhouse).padStart(2, '0')}</strong><small>Currently checked-in reservations</small></Link><Link className="desk-metric" to="/readiness"><span>Rooms to prepare <Sparkles size={17} /></span><strong>{String(prepare).padStart(2, '0')}</strong><small>In-service rooms needing attention</small></Link></div>}
      {dashboard ? <div className="desk-columns"><section className="desk-panel"><div className="desk-panel-heading"><div><p className="eyebrow">TODAY’S GUEST BOOK</p><h2>A warm welcome awaits.</h2></div><Link className="text-link" to="/reservations">All stays <ArrowUpRight size={13} /></Link></div><div className="desk-search"><ReservationSearch value={search} onChange={setSearch} /></div>{filterTabs}<StaffReservations items={matching} today={today} compact onChange={load} empty={`No ${scope === 'inhouse' ? 'guests in house' : scope} in this view.`} /><div className="desk-panel-footer">{prettyDate(today)} · Hotel local time</div></section>
        <section className="desk-panel"><div className="desk-panel-heading"><div><p className="eyebrow">MAKE ROOM FOR A GOOD STAY</p><h2>Room readiness</h2></div><Link className="text-link" to="/readiness">Manage <ArrowUpRight size={13} /></Link></div><div className="room-snapshot"><div className="room-snapshot-grid">{rooms.map(room => <Link key={room.id} to="/readiness" className={`room-tile ${room.operationalStatus === 'out_of_service' ? 'out_of_service' : room.housekeepingStatus}`} aria-label={`Room ${room.number}: ${room.operationalStatus === 'out_of_service' ? 'out of service' : room.housekeepingStatus}`}>{room.number}</Link>)}</div><div className="mini-legend">{['clean', 'dirty', 'cleaning', 'out_of_service'].map(status => <span key={status}><i className={status} />{status === 'dirty' ? 'To clean' : status.replaceAll('_', ' ')}</span>)}</div></div><div className="desk-note"><Sparkles size={17} /><div><strong>{prepare ? `${prepare} rooms need a little care.` : 'Ready for a warm welcome.'}</strong><p>Room condition is separate from date-based availability. Check the stay dates before confirming a room.</p></div></div></section></div> : <><div className="section-toolbar">{filterTabs}<ReservationSearch value={search} onChange={setSearch} /></div><section className="desk-panel"><StaffReservations items={matching} today={today} onChange={load} /><p className="staff-table-note">{matching.length} matching reservations · Up to 100 recent stays · Stay values are not collected payments.</p></section></>}
    </>}
  </div>;
}

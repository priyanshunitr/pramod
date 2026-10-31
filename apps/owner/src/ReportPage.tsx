import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDownLeft, ArrowUpRight, BedDouble, CalendarDays, ChevronRight, CircleCheck, Clock3, DoorOpen, RefreshCw, Search, Sparkles, Wallet } from 'lucide-react';
import { api, ApiError, useAuth, type OwnerDashboard, type OwnerRoom, type PropertyCatalog } from '@hotel/api-client';
import { addDays, BookingList, formatMoney, prettyDate, todayAtHotel } from '@hotel/ui';
import { selectBookings } from './filters';

type View = 'overview' | 'availability' | 'reservations';
const labels = { available: 'Available', reserved: 'Reserved', out_of_service: 'Out of service', clean: 'Clean', dirty: 'Needs cleaning', cleaning: 'Cleaning' };

export function ReportPage({ property, view }: { property: PropertyCatalog; view: View }) {
  const auth = useAuth(); const [params, setParams] = useSearchParams();
  const today = todayAtHotel(property.timezone);
  const from = params.get('from') || today; const to = params.get('to') || addDays(today, 7); const roomTypeId = params.get('roomTypeId') || '';
  const [report, setReport] = useState<OwnerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const query = new URLSearchParams({ from, to, ...(roomTypeId ? { roomTypeId } : {}) }).toString();
  const refresh = () => setVersion(value => value + 1);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(null); setReport(null);
    api<OwnerDashboard>(`/properties/${property.id}/owner/dashboard?${query}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setReport(data); })
      .catch(error => { if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Could not load the hotel report.'); if (error instanceof ApiError && [401, 403].includes(error.status)) void auth.refresh(); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [property.id, query, version, auth.refresh]);
  function setWindow(start: string, end: string, type = roomTypeId) {
    const next = new URLSearchParams(params); next.set('from', start); next.set('to', end); type ? next.set('roomTypeId', type) : next.delete('roomTypeId');
    next.delete('booking'); setParams(next); setFormError(null);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); const start = String(fields.get('from')); const end = String(fields.get('to'));
    const nights = (Date.parse(end) - Date.parse(start)) / 86400000;
    if (!Number.isFinite(nights) || nights < 1 || nights > 30 || start < today) { setFormError('Choose 1–30 nights, starting today or later.'); return; }
    setWindow(start, end, String(fields.get('roomTypeId')));
  }
  const path = (route: string, extra: Record<string, string> = {}) => `${route}?${new URLSearchParams({ from, to, ...(roomTypeId ? { roomTypeId } : {}), ...extra })}`;
  return <>
    <div className="portal-page-heading"><div><p className="eyebrow">{view === 'overview' ? 'A LITTLE PERSPECTIVE, EVERY DAY' : view === 'availability' ? 'EVERY ROOM, ACCOUNTED FOR' : 'THE GUEST BOOK'}</p><h1>{view === 'overview' ? <>Your hotel, <em>at a glance.</em></> : view === 'availability' ? <>Room <em>availability.</em></> : <>Guest <em>reservations.</em></>}</h1><p>{view === 'overview' ? 'A clear picture of today, and the stays ahead.' : view === 'availability' ? 'Plan ahead with availability for every room and every night.' : 'Follow each stay from the first booking to the last goodbye.'}</p></div><button className="button secondary report-refresh" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading ? 'spinning' : ''} />Refresh</button></div>
    <form className="report-filters" onSubmit={apply} key={query}><div className="report-filter-title"><CalendarDays size={17} /><span>Stay window<small>Checkout date excluded</small></span></div><label>From<input type="date" name="from" defaultValue={from} min={today} required /></label><span className="date-arrow" aria-hidden="true">—</span><label>To<input type="date" name="to" defaultValue={to} min={addDays(today, 1)} required /></label><label className="type-filter">Room type<select name="roomTypeId" defaultValue={roomTypeId}><option value="">All room types</option>{property.roomTypes.map(type => <option value={type.id} key={type.id}>{type.name}</option>)}</select></label><button className="button primary" type="submit">Apply</button></form>
    <div className="report-window"><div className="period-shortcuts">{[7, 14, 30].map(days => <button key={days} aria-pressed={from === today && to === addDays(today, days)} onClick={() => setWindow(today, addDays(today, days))}>Next {days} nights</button>)}</div><span>{report ? `Updated ${new Intl.DateTimeFormat('en-IN', { timeZone: property.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(report.generatedAt))}` : 'Hotel local time'} · {property.timezone}</span></div>
    {formError && <p className="form-error" role="alert">{formError}</p>}
    {error && <div className="empty-state" role="alert"><h2>We couldn’t load this view.</h2><p>{error}</p><button className="button secondary" onClick={refresh}>Try again</button><button className="text-link" onClick={() => setWindow(today, addDays(today, 7), '')}>Reset filters</button></div>}
    {loading && <div className="report-loading" role="status"><span className="loading-line" /><p>Gathering your hotel’s latest details…</p><div>{[1, 2, 3, 4].map(item => <span key={item} />)}</div></div>}
    {!loading && report && <>{view === 'overview' ? <Overview report={report} path={path} onDay={date => setWindow(date, addDays(date, 1))} /> : view === 'availability' ? <><div className="availability-summary"><span><strong>{report.summary.availableRooms}</strong> available for the whole stay</span><span><strong>{report.rooms.filter(room => room.status === 'reserved').length}</strong> reserved for part or all of the stay</span><span><strong>{report.summary.outOfServiceRooms}</strong> out of service</span></div><Outlook report={report} onDay={date => setWindow(date, addDays(date, 1))} /><RoomInventory report={report} path={path} /></> : <Reservations report={report} refresh={refresh} />}</>}
  </>;
}

function Metric({ label, value, note, icon, href }: { label: string; value: ReactNode; note: string; icon: ReactNode; href: string }) {
  return <Link to={href} className="metric-card"><div className="metric-label"><span>{label}</span>{icon}</div><strong className="metric-value">{value}</strong><div className="metric-note"><span>{note}</span><ArrowUpRight size={14} /></div></Link>;
}

function Overview({ report, path, onDay }: { report: OwnerDashboard; path: (route: string, extra?: Record<string, string>) => string; onDay: (date: string) => void }) {
  const { summary } = report;
  const value = summary.bookingValueByCurrency.length ? summary.bookingValueByCurrency.map(item => <span key={item.currency}>{formatMoney(item.amountMinor / 100, item.currency)}</span>) : formatMoney(0, report.property.currency);
  return <>
    <div className="metrics-grid"><Metric label="Occupancy right now" value={summary.occupancyPercent === null ? '—' : <>{summary.occupancyPercent}<small>%</small></>} note={`${summary.occupiedInServiceRooms} of ${summary.inServiceRooms} in-service rooms occupied`} icon={<BedDouble size={17} />} href={path('/reservations', { scope: 'inhouse' })} /><Metric label="Rooms available" value={<>{summary.availableRooms}<small> / {summary.totalRooms}</small></>} note="Available for your entire stay window" icon={<DoorOpen size={17} />} href={path('/availability', { status: 'available' })} /><Metric label="Booking value" value={<span className="money-values">{value}</span>} note="Selected nights · payments not collected" icon={<Wallet size={17} />} href={path('/reservations', { scope: 'value' })} /><Metric label="Reservations" value={summary.reservations} note={`${summary.cancelled} cancelled · selected stay window`} icon={<CalendarDays size={17} />} href={path('/reservations')} /></div>
    <div className="today-strip"><div><span className="today-mark"><Clock3 size={18} /></span><div><strong>Today at Pramod</strong><small>{prettyDate(report.today)} · hotel local time</small></div></div><Link to={path('/reservations', { scope: 'arrivals' })}><ArrowDownLeft size={17} /><strong>{summary.arrivalsToday}</strong><span>scheduled arrivals</span><ChevronRight size={14} /></Link><Link to={path('/reservations', { scope: 'departures' })}><ArrowUpRight size={17} /><strong>{summary.departuresToday}</strong><span>scheduled departures</span><ChevronRight size={14} /></Link><Link to="/readiness"><Sparkles size={17} /><strong>{summary.readiness.dirty + summary.readiness.cleaning}</strong><span>rooms to prepare</span><ChevronRight size={14} /></Link></div>
    <div className="overview-middle"><Outlook report={report} onDay={onDay} /><section className="report-panel readiness-panel"><div className="panel-heading"><div><p className="eyebrow">READY FOR A WARM WELCOME</p><h2>Room readiness</h2></div><Sparkles size={19} /></div><div className="readiness-total"><strong>{summary.readiness.clean}</strong><span>clean rooms<br /><small>of {summary.inServiceRooms} in service</small></span></div><div className="readiness-meter" aria-label={`${summary.readiness.clean} clean, ${summary.readiness.dirty} dirty, ${summary.readiness.cleaning} cleaning`}>{(['clean', 'dirty', 'cleaning'] as const).map(status => <span key={status} className={status} style={{ flexGrow: summary.readiness[status] }} />)}</div><div className="readiness-legend">{(['clean', 'dirty', 'cleaning'] as const).map(status => <Link to="/readiness" key={status}><span className={`legend-dot ${status}`} />{labels[status]}<strong>{summary.readiness[status]}</strong></Link>)}</div><div className="readiness-footer"><span>{summary.outOfServiceRooms} out of service</span><Link to="/readiness">Manage rooms <ArrowUpRight size={14} /></Link></div></section></div>
    <RoomInventory report={report} path={path} preview />
    <p className="report-footnote"><CircleCheck size={13} />Figures come from hotel reservations and room records. Booking value is the agreed value of selected nights; it is not payment revenue.</p>
  </>;
}

function Outlook({ report, onDay }: { report: OwnerDashboard; onDay: (date: string) => void }) {
  return <section className="report-panel outlook-panel"><div className="panel-heading"><div><p className="eyebrow">THE STAYS AHEAD</p><h2>Reservation outlook</h2></div><div className="chart-legend"><span><i className="legend-dot reserved" />Reserved</span><span><i className="legend-dot available" />Available</span></div></div><p className="panel-subtitle">{prettyDate(report.from)} – {prettyDate(addDays(report.to, -1))} · {report.summary.inServiceRooms} rooms in service</p><div className="chart-scroll"><div className="outlook-chart" style={{ minWidth: Math.max(280, report.daily.length * 39) }} role="group" aria-label="Nightly reservation and availability counts">{report.daily.map(day => <button className="chart-day" key={day.date} onClick={() => onDay(day.date)} aria-label={`${prettyDate(day.date)}: ${day.reservedRooms} reserved, ${day.availableRooms} available. View this night.`}><span className="chart-count">{day.reservedRooms}<small>/{report.summary.inServiceRooms}</small></span><span className="chart-bar"><span className="bar-available" style={{ flexGrow: day.availableRooms }} /><span className="bar-reserved" style={{ flexGrow: day.reservedRooms }} /></span><span className="chart-date">{prettyDate(day.date)}</span></button>)}</div></div><div className="chart-note"><span>Reserved rooms per night. Select a bar to inspect that night.</span><BedDouble size={14} /></div></section>;
}

function RoomInventory({ report, path, preview = false }: { report: OwnerDashboard; path: (route: string, extra?: Record<string, string>) => string; preview?: boolean }) {
  const [params, setParams] = useSearchParams(); const [search, setSearch] = useState('');
  const status = params.get('status') || 'all'; const [expanded, setExpanded] = useState<string | null>(null);
  const setStatus = (value: string) => { const next = new URLSearchParams(params); value === 'all' ? next.delete('status') : next.set('status', value); setParams(next); };
  const rooms = report.rooms.filter(room => (status === 'all' || room.status === status) && `${room.number} ${room.roomTypeName}`.toLowerCase().includes(search.toLowerCase()));
  const displayed = preview ? rooms.slice(0, 5) : rooms;
  return <section className="report-panel room-inventory"><div className="panel-heading"><div><p className="eyebrow">A PLACE FOR EVERY GUEST</p><h2>Your rooms</h2></div>{preview ? <Link className="text-link" to={path('/availability')}>View all rooms <ArrowUpRight size={15} /></Link> : <span className="room-count">{rooms.length} rooms</span>}</div><p className="panel-subtitle">Availability for the selected window. Occupancy and housekeeping show the current state.</p>{!preview && <div className="inventory-filters"><label className="search-field"><Search size={15} /><input aria-label="Search rooms" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search room number or type" /></label><label className="status-select">Availability<select aria-label="Filter room availability" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="out_of_service">Out of service</option></select></label></div>}
    <div className="table-scroll"><table className="rooms-table"><thead><tr><th>Room</th><th>Availability</th><th>Right now</th><th>Housekeeping</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{displayed.map(room => <RoomRows key={room.id} room={room} expanded={expanded === room.id} toggle={() => setExpanded(expanded === room.id ? null : room.id)} path={path} />)}</tbody></table></div>
    {!rooms.length && <div className="rooms-empty"><BedDouble size={24} /><h3>{report.rooms.length ? 'No rooms match these filters.' : 'No rooms added yet.'}</h3><p>{report.rooms.length ? 'Try another room number, type, or availability status.' : 'Room inventory will appear here once rooms are configured for the hotel.'}</p></div>}
    <div className="table-footer"><span>{preview ? `Showing ${displayed.length} of ${report.rooms.length} rooms` : `${rooms.length} rooms match your filters`}</span><span>Checkout day can be booked again.</span></div>
  </section>;
}

function RoomRows({ room, expanded, toggle, path }: { room: OwnerRoom; expanded: boolean; toggle: () => void; path: (route: string, extra?: Record<string, string>) => string }) {
  return <><tr><td><div className="room-cell"><span className="room-icon"><BedDouble size={17} /></span><div><strong>Room {room.number}</strong><small>{room.roomTypeName}</small></div></div></td><td><span className={`room-status ${room.status}`}><i />{labels[room.status]}</span></td><td><span className={room.occupied ? 'occupied-label' : 'vacant-label'}>{room.occupied ? 'Occupied' : 'Vacant'}</span></td><td><span className={`housekeeping-label ${room.housekeepingStatus}`}><i className={`legend-dot ${room.housekeepingStatus}`} />{labels[room.housekeepingStatus]}</span></td><td><button className="icon-button details-button" aria-label={`${expanded ? 'Hide' : 'View'} room ${room.number} details`} aria-expanded={expanded} onClick={toggle}><ChevronRight size={17} /></button></td></tr>{expanded && <tr className="room-detail-row"><td colSpan={5}><div><strong>Room {room.number} · {room.operationalStatus === 'active' ? 'In service' : 'Out of service'}</strong><p>{room.reservations.length ? 'Reservations overlapping this window:' : 'No active reservations overlap this window.'}</p>{room.reservations.map(booking => <Link key={booking.id} to={path('/reservations', { booking: booking.id })}>{prettyDate(booking.checkIn)} – {prettyDate(booking.checkOut)}<span>{booking.status.replaceAll('_', ' ')}</span><ArrowUpRight size={13} /></Link>)}<Link to="/readiness">Update housekeeping <ArrowUpRight size={13} /></Link></div></td></tr>}</>;
}

function Reservations({ report, refresh }: { report: OwnerDashboard; refresh: () => void }) {
  const [params, setParams] = useSearchParams(); const [search, setSearch] = useState('');
  const scope = params.get('scope') || 'period'; const bookingId = params.get('booking') || '';
  const items = useMemo(() => selectBookings(report, scope, search, bookingId), [report, scope, search, bookingId]);
  return <><div className="reservation-filterbar"><label className="search-field"><Search size={16} /><input aria-label="Search reservations" value={search} onChange={event => setSearch(event.target.value)} placeholder="Guest, email, room, or reference" /></label><label className="status-select">Show<select aria-label="Filter reservations" value={scope} onChange={event => { const next = new URLSearchParams(params); next.set('scope', event.target.value); next.delete('booking'); setParams(next); }}><option value="period">All stays in window</option><option value="confirmed">Confirmed in window</option><option value="checked_in">Checked in · window</option><option value="checked_out">Checked out · window</option><option value="cancelled">Cancelled in window</option><option value="value">Booking value · noncancelled</option><option value="arrivals">Today’s scheduled arrivals</option><option value="departures">Today’s scheduled departures</option><option value="inhouse">All currently checked in</option></select></label></div>{bookingId && <p className="notice">Showing the selected reservation. <button className="text-link" onClick={() => { const next = new URLSearchParams(params); next.delete('booking'); setParams(next); }}>Show all matching stays</button></p>}{scope === 'value' && <p className="notice">The dashboard totals only nights inside the selected window. Each reservation below shows its full agreed stay value.</p>}<BookingList propertyId={report.property.id} items={items} onChange={refresh} /></>;
}

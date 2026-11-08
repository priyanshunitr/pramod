import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { ApiError, type OwnerBookedRooms } from '@hotel/api-client';
import { todayAtHotel, useWorkspace } from '@hotel/ui';

const validMonth = (month: string) => /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) < 9999;
const monthLabel = (month: string) => new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const dayLabel = (date: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

export function MonthlyBookingsChart({ roomTypeId }: { roomTypeId: string }) {
  const { property, request, refreshAccess } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const month = params.get('month') ?? todayAtHotel(property.timezone).slice(0, 7);
  const [response, setReport] = useState<OwnerBookedRooms | null>(null);
  const report = response?.month === month && response.roomTypeId === (roomTypeId || null) ? response : null;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState<{ index: number; left: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const headingId = useId();
  useEffect(() => {
    const controller = new AbortController();
    setReport(null); setError(''); setActive(null);
    if (!validMonth(month)) { setLoading(false); setError('Choose a valid month.'); return () => controller.abort(); }
    setLoading(true);
    const query = new URLSearchParams({ month, ...(roomTypeId ? { roomTypeId } : {}) });
    request<OwnerBookedRooms>(`/properties/${property.id}/owner/booked-rooms?${query}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setReport(data); })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Could not load monthly bookings.');
        if (cause instanceof ApiError && [401, 403].includes(cause.status)) refreshAccess();
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [property.id, month, roomTypeId, request, refreshAccess, retry]);

  function showDay(index: number, target: HTMLButtonElement) {
    if (!frame.current) return;
    const bounds = frame.current.getBoundingClientRect();
    const bar = target.getBoundingClientRect();
    const halfWidth = Math.min(140, (bounds.width - 16) / 2);
    setActive({ index, left: Math.max(halfWidth + 8, Math.min(bounds.width - halfWidth - 8, bar.left - bounds.left + bar.width / 2)) });
  }
  const peak = Math.max(0, ...(report?.days.map(day => day.bookedRooms) ?? []));
  const step = Math.max(1, Math.ceil(peak / 4));
  const ceiling = step * 4;
  const roomNights = report?.days.reduce((sum, day) => sum + day.bookedRooms, 0) ?? 0;
  const selected = active ? report?.days[active.index] : undefined;
  const roomTypeName = property.roomTypes.find(type => type.id === roomTypeId)?.name ?? 'All room types';

  return <section id="monthly-bookings" className="report-panel monthly-bookings" aria-labelledby={headingId}>
    <div className="panel-heading monthly-heading">
      <div><p className="eyebrow">A MONTH OF STAYS</p><h2 id={headingId}>Rooms booked per day</h2></div>
      <label className="monthly-picker"><CalendarDays size={16} aria-hidden="true" /><span>Month</span>
        <input type="month" aria-label="Booking chart month" min="1000-01" max="9998-12" value={month} onChange={event => {
          const next = new URLSearchParams(params); next.set('month', event.target.value); setParams(next, { replace: true });
        }} />
      </label>
    </div>
    <p className="panel-subtitle">{roomTypeName} · Booked stay dates · {property.timezone}</p>
    {loading ? <div className="monthly-message" role="status">Loading monthly bookings…</div> : error ? <div className="monthly-message" role="alert"><p>{error}</p>{validMonth(month) && <button className="button secondary" onClick={() => setRetry(value => value + 1)}>Try again</button>}</div> : report && <>
      <div className="monthly-summary"><span><strong>{roomNights}</strong> room nights in {monthLabel(month)}</span><span>Peak day <strong>{peak}</strong> {peak === 1 ? 'room' : 'rooms'}</span></div>
      <div className="monthly-frame" ref={frame} onMouseLeave={() => setActive(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActive(null); }} onKeyDown={event => { if (event.key === 'Escape') setActive(null); }}>
        <p className="monthly-axis-title">Rooms booked</p>
        <div className="monthly-chart-layout">
          <div className="monthly-y-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map(tick => <span key={tick}>{tick * step}</span>)}</div>
          <div className="monthly-chart-scroll" onScroll={event => {
            if (!active) return;
            const target = event.currentTarget.querySelectorAll('button')[active.index];
            const bounds = event.currentTarget.getBoundingClientRect();
            const bar = target?.getBoundingClientRect();
            if (!target || !bar || bar.right <= bounds.left || bar.left >= bounds.right) setActive(null);
            else showDay(active.index, target);
          }}>
            <div className="monthly-bars" role="group" aria-label={`Rooms booked each night in ${monthLabel(month)}`} style={{ gridTemplateColumns: `repeat(${report.days.length}, minmax(22px, 1fr))` }}>
              {report.days.map((day, index) => <button type="button" className={`monthly-day${active?.index === index ? ' is-active' : ''}`} key={day.date}
                aria-label={`${dayLabel(day.date)}: ${day.bookedRooms} ${day.bookedRooms === 1 ? 'room' : 'rooms'} booked${day.roomNumbers.length ? `. Room numbers: ${day.roomNumbers.join(', ')}` : ''}`}
                aria-describedby={active?.index === index ? tooltipId : undefined}
                onMouseEnter={event => showDay(index, event.currentTarget)} onFocus={event => showDay(index, event.currentTarget)} onClick={event => showDay(index, event.currentTarget)}>
                <span className="monthly-column" aria-hidden="true"><span className="monthly-bar" style={{ height: `${day.bookedRooms / ceiling * 100}%` }}><span className="monthly-count">{day.bookedRooms}</span></span></span>
                <span className="monthly-date" aria-hidden="true">{Number(day.date.slice(-2))}</span>
              </button>)}
            </div>
          </div>
        </div>
        {selected && active && <div className="monthly-tooltip" id={tooltipId} role="tooltip" style={{ left: active.left }}>
          <span className="monthly-tooltip-date">{dayLabel(selected.date)}</span>
          <strong>{selected.bookedRooms} {selected.bookedRooms === 1 ? 'room' : 'rooms'} booked</strong>
          {selected.roomNumbers.length ? <div className="monthly-room-list"><span>Room numbers</span><div>{selected.roomNumbers.map(number => <span key={number}>{number}</span>)}</div></div> : <p>No rooms booked for this night.</p>}
        </div>}
        <p className="monthly-x-title">Day of month</p>
      </div>
      {roomNights === 0 && <p className="monthly-empty" role="status">No rooms booked in {monthLabel(month)}{roomTypeId ? ` for ${roomTypeName}` : ''}.</p>}
      <div className="monthly-footer"><span>Hover, focus, or tap a day to see room numbers.</span><span>Checkout dates and cancellations excluded. Month applies to this chart.</span></div>
    </>}
  </section>;
}

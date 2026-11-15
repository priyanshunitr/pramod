import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';
import type { OwnerDashboard } from '@hotel/contracts';
import { prettyDate } from '@hotel/ui';
import { calendarSegments } from './calendar';

export function RoomCalendar({ report, path }: { report: OwnerDashboard; path: (route: string, extra?: Record<string, string>) => string }) {
  const dates = report.daily.map(day => day.date);
  return <section className="report-panel room-calendar"><div className="panel-heading"><div><p className="eyebrow">EVERY ROOM. EVERY NIGHT.</p><h2>The room calendar</h2></div><CalendarDays size={19} /></div><p className="panel-subtitle">Each bar covers one reservation’s nights. Select it to see the stay.</p>
    <div className="calendar-scroll" tabIndex={0} role="region" aria-label="Scrollable room availability calendar">
      <table className="calendar-table" style={{ minWidth: `calc(var(--calendar-room-width) + ${dates.length * 86}px)` }}>
        <colgroup><col className="calendar-room-column" />{dates.map(date => <col key={date} />)}</colgroup>
        <thead><tr><th scope="col">Room / night</th>{report.daily.map(day => <th scope="col" key={day.date}><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))}</span><strong>{prettyDate(day.date)}</strong></th>)}</tr></thead>
        <tbody>{report.rooms.map(room => <tr key={room.id}>
          <th scope="row"><strong>{room.number}</strong><small>{room.roomTypeName}</small></th>
          {calendarSegments(room, dates).map(({ from, lastNight, nights, state, booking }) => {
            const period = nights === 1 ? prettyDate(from) : `nights ${prettyDate(from)} through ${prettyDate(lastNight)}`;
            const description = `Room ${room.number}, ${period}: ${state.replaceAll('-', ' ')}`;
            return <td key={from} colSpan={nights}>
              {booking ? <Link className={`calendar-night ${state}`} to={path('/reservations', { booking: booking.id })} aria-label={`${description}. View reservation.`} title={description}>
                <span aria-hidden="true">Reserved{nights > 1 && ` · ${nights} nights`}</span>
              </Link> : <span role="img" aria-label={description} className={`calendar-night ${state}`}><span aria-hidden="true">{state === 'available' ? '—' : 'Offline'}</span></span>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {!report.rooms.length && <p className="staff-empty">No rooms configured for this room type.</p>}
    <div className="calendar-footer"><div className="calendar-legend"><span><i className="available" />Available</span><span><i className="reserved" />Reserved</span><span><i className="out-of-service" />Out of service</span></div><span>Checkout day is available for a new stay.</span></div>
  </section>;
}

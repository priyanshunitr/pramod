import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';
import type { OwnerDashboard } from '@hotel/contracts';
import { addDays, prettyDate } from '@hotel/ui';

export function RoomCalendar({ report, path }: { report: OwnerDashboard; path: (route: string, extra?: Record<string, string>) => string }) {
  return <section className="report-panel room-calendar"><div className="panel-heading"><div><p className="eyebrow">EVERY ROOM. EVERY NIGHT.</p><h2>The room calendar</h2></div><CalendarDays size={19} /></div><p className="panel-subtitle">A night-by-night view of your inventory. Select a reserved night to see the stay.</p>
    <div className="calendar-scroll" tabIndex={0} role="region" aria-label="Scrollable room availability calendar"><table className="calendar-table"><thead><tr><th scope="col">Room / night</th>{report.daily.map(day => <th scope="col" key={day.date}><span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`))}</span><strong>{prettyDate(day.date)}</strong></th>)}</tr></thead><tbody>{report.rooms.map(room => <tr key={room.id}><th scope="row"><strong>{room.number}</strong><small>{room.roomTypeName}</small></th>{report.daily.map(day => {
      const booking = room.reservations.find(stay => stay.checkIn < addDays(day.date, 1) && stay.checkOut > day.date);
      const state = room.operationalStatus === 'out_of_service' ? 'out-of-service' : booking ? 'reserved' : 'available';
      const description = `Room ${room.number}, ${prettyDate(day.date)}: ${state.replaceAll('-', ' ')}`;
      return <td key={day.date}>{booking ? <Link className={`calendar-night ${state}`} to={path('/reservations', { booking: booking.id })} aria-label={`${description}. View reservation.`}><span aria-hidden="true">Reserved</span></Link> : <span role="img" aria-label={description} className={`calendar-night ${state}`}><span aria-hidden="true">{state === 'available' ? '—' : 'Offline'}</span></span>}</td>;
    })}</tr>)}</tbody></table></div>
    {!report.rooms.length && <p className="staff-empty">No rooms configured for this room type.</p>}
    <div className="calendar-footer"><div className="calendar-legend"><span><i className="available" />Available</span><span><i className="reserved" />Reserved</span><span><i className="out-of-service" />Out of service</span></div><span>Checkout day is available for a new stay.</span></div>
  </section>;
}

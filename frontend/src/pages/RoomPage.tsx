import { ArrowLeft, ArrowUpRight, BedDouble, Coffee, ShieldCheck, UsersRound, Wifi, Wind } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useCatalog } from '../context/CatalogContext';
import { CatalogFeedback } from '../components/CatalogFeedback';
import { StaySearch } from '../components/StaySearch';
import { formatMoney, hotel, roomPresentation } from '../config/hotel';
import { nights, prettyDate, stayFromParams, stayQuery, todayAtHotel, validateStay } from '../lib/stay';
import { NotFoundPage } from './NotFoundPage';

export function RoomPage() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const { property, loading, error } = useCatalog();
  const room = property?.roomTypes.find((item) => item.id === roomId);
  if (loading || error) return <div className="container page-content"><CatalogFeedback /></div>;
  if (!room) return <NotFoundPage room />;
  const detail = roomPresentation(room.name);
  const today = todayAtHotel(property?.timezone ?? hotel.timezone);
  const stay = stayFromParams(params, today);
  const problem = validateStay(stay, today) ?? (stay.guests > room.maxGuests ? `This room accommodates up to ${room.maxGuests} guests. Please adjust your guest count.` : null);
  return <div className="container page-content room-detail"><Link to={`/rooms?${stayQuery(stay)}`} className="back-link"><ArrowLeft size={16} /> Back to the room collection</Link><div className="detail-heading"><div><p className="eyebrow">{detail.tag}</p><h1>{room.name}</h1></div><span className="room-capacity"><UsersRound size={17} /> Up to {room.maxGuests} guests</span></div><div className="detail-photo"><img src={detail.image} alt={`Illustrative ${room.name} interior`} width="1200" height="800" /><span>ILLUSTRATIVE ROOM PHOTOGRAPHY</span></div>
    <div className="detail-columns"><div className="detail-description"><p className="eyebrow">SETTLE IN. STAY A WHILE.</p><h2>Your own little <em>escape.</em></h2><p>{detail.intro}</p><p>{room.description}</p><div className="detail-amenities">{[{ Icon: BedDouble, label: detail.bed }, { Icon: UsersRound, label: `Up to ${room.maxGuests} guests` }, { Icon: Wifi, label: 'Wi-Fi' }, { Icon: Wind, label: 'Air conditioning' }, { Icon: Coffee, label: 'Tea & coffee' }, { Icon: ShieldCheck, label: 'In-room safe' }].map(({ Icon, label }) => <span key={label}><Icon size={20} strokeWidth={1.4} />{label}</span>)}</div><p className="fine-print">Amenities and bed arrangements are sample content pending hotel confirmation.</p><h3>Good to know</h3><p>Review your stay to check available rooms and the current total. You can reserve after signing in, or keep a plan for later. Demo prices exclude taxes; online payments are not configured.</p></div>
      <aside className="plan-card"><p className="eyebrow">MAKE TIME FOR YOURSELF</p><h3>Plan a little <em>getaway.</em></h3><div className="detail-rate">{room.nightlyRateMinor != null ? <><strong>{formatMoney(room.nightlyRateMinor! / 100, property?.currency)}</strong><span> / night</span></> : <strong>Rate on request</strong>}<small>Demo rate · availability checked at review</small></div><StaySearch key={params.toString()} compact roomId={room.id} />{problem ? <p className="form-error" role="alert">{problem}</p> : <><div className="plan-date-summary">{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)}<span>{nights(stay)} nights · {stay.guests} {stay.guests === 1 ? 'guest' : 'guests'} · 1 room</span></div><Link to={`/stay?room=${encodeURIComponent(room.id)}&${stayQuery(stay)}`} className="button primary full-width">Review your stay <ArrowUpRight size={18} /></Link></>}<p className="fine-print centered">Reviewing a stay does not reserve a room.</p></aside>
    </div>
  </div>;
}

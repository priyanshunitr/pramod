import { ArrowUpRight, BedDouble, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney, roomPresentation } from '../config/hotel';
import type { PropertyCatalog } from '../lib/api';

export function RoomCard({ room, currency, query = '' }: { room: PropertyCatalog['roomTypes'][number]; currency: string; query?: string }) {
  const details = roomPresentation(room.name);
  const url = `/rooms/${room.id}${query ? `?${query}` : ''}`;
  return <article className="room-card">
    <Link to={url} className="room-image-link" aria-label={`Explore ${room.name}`}><img src={details.image} alt={`Illustrative interior for ${room.name}`} loading="lazy" width="600" height="450" /><span className="image-arrow"><ArrowUpRight size={20} /></span></Link>
    <div className="room-card-body"><span className="eyebrow">{details.tag}</span><h3><Link to={url}>{room.name}</Link></h3><p>{room.description}</p>
      <div className="room-meta"><span><UsersRound size={15} /> Up to {room.maxGuests} guests</span><span><BedDouble size={15} /> {details.bed}</span></div>
      <div className="room-card-bottom"><div><span className="rate-label">ROOM RATE</span>{room.nightlyRateMinor != null ? <span className="price">{formatMoney(room.nightlyRateMinor! / 100, currency)} <small>/ night</small></span> : <span className="price small-price">Rate on request</span>}</div><Link to={url} className="text-link" aria-label={`View ${room.name} details`}>View room <ArrowUpRight size={16} /></Link></div>
    </div>
  </article>;
}

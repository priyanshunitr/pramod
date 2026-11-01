import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { StaySearch } from '../components/StaySearch';
import { RoomCard } from '../components/RoomCard';
import { CatalogFeedback } from '../components/CatalogFeedback';
import { useCatalog } from '../context/CatalogContext';
import { hotel } from '../config/hotel';
import { stayFromParams, stayQuery, todayAtHotel, validateStay } from '../lib/stay';
import { useAvailability } from '../lib/useAvailability';

export function RoomsPage() {
  const { property, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState('recommended');
  const today = todayAtHotel(property?.timezone ?? hotel.timezone);
  const stay = stayFromParams(params, today);
  const problem = validateStay(stay, today);
  const availability = useAvailability(property?.id, problem ? null : stay);
  const rooms = (property?.roomTypes ?? []).flatMap(room => {
    const quote = availability.data?.roomTypes.find(item => item.id === room.id && item.availableRooms > 0);
    return quote ? [{ ...room, nightlyRateMinor: quote.nightlyRateMinor }] : [];
  });
  if (sort !== 'recommended') rooms.sort((a, b) => a.nightlyRateMinor - b.nightlyRateMinor);
  return <div className="container page-content"><div className="page-heading"><p className="eyebrow">ROOMS & SUITES</p><h1>A space that feels<br /><em>like yours.</em></h1><p>Choose your dates, bring your favourite people, and find your corner of {hotel.name}.</p></div>
    <StaySearch key={params.toString()} compact timezone={property?.timezone} />
    <div className="results-toolbar"><p>{availability.loading ? 'Checking availability…' : `${rooms.length} available room types for ${stay.guests} ${stay.guests === 1 ? 'guest' : 'guests'}`}<span>Availability checked for your dates · confirmed when reserved</span></p><label><SlidersHorizontal size={15} /><span className="sr-only">Sort rooms</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="price">Price: low to high</option></select></label></div>
    <CatalogFeedback />
    {problem && <div className="empty-state" role="alert"><h2>Let’s adjust your stay.</h2><p>{problem}</p><button className="button secondary" onClick={() => setParams({})}>Reset dates and guests</button></div>}
    {availability.error && <div className="form-error" role="alert">{availability.error}<button className="text-link" onClick={availability.refresh}>Check again</button></div>}
    {!loading && !error && !problem && !availability.loading && !availability.error && (rooms.length ? <div className="room-grid">{rooms.map(room => <RoomCard key={room.id} room={room} currency={property?.currency ?? 'INR'} query={stayQuery(stay)} />)}</div> : <div className="empty-state"><h2>Let’s find another stay.</h2><p>No single room is available for these dates and {stay.guests} guests. Try different dates or fewer guests.</p><button className="button secondary" onClick={() => setParams({})}>Reset dates and guests</button></div>)}
    <div className="quiet-note"><strong>About this local hotel demo</strong><p>Availability and prices come from the database. Photos, amenities, and configured rates are illustrative. Searching does not reserve a room.</p></div>
  </div>;
}

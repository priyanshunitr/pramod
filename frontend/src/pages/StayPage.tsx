import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Heart, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useCatalog } from '../context/CatalogContext';
import { CatalogFeedback } from '../components/CatalogFeedback';
import { BookingPanel } from '../components/BookingPanel';
import { hotel, roomPresentation } from '../config/hotel';
import { PLAN_KEY, prettyDate, readSavedPlan, stayFromParams, stayQuery, todayAtHotel, validateStay, type StayPlan } from '../lib/stay';

export function StayPage() {
  const { property, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [saved, setSaved] = useState(readSavedPlan);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayAtHotel(property?.timezone ?? hotel.timezone);
  const selectedId = params.get('room');
  const plan: StayPlan | null = selectedId ? { roomId: selectedId, ...stayFromParams(params, today) } : saved;
  if (loading || error) return <div className="container page-content"><CatalogFeedback /></div>;
  const room = property?.roomTypes.find(item => item.id === plan?.roomId);
  if (!plan || !room || !property) return <div className="container page-content"><div className="empty-state large"><Heart size={34} strokeWidth={1} /><p className="eyebrow">SOMETHING TO LOOK FORWARD TO</p><h1>Your next stay<br />starts with <em>a little plan.</em></h1><p>Choose your room and dates to review a stay.</p><Link className="button primary" to="/rooms">Find your room <ArrowUpRight size={18} /></Link></div></div>;
  const details = roomPresentation(room.name);
  const problem = validateStay(plan, today) ?? (plan.guests > room.maxGuests ? 'The number of guests exceeds this room’s capacity.' : null);
  const isSaved = saved && saved.roomId === plan.roomId && saved.checkIn === plan.checkIn && saved.checkOut === plan.checkOut && saved.guests === plan.guests;
  function save() {
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(plan)); setSaved(plan); setNotice('Plan saved on this device. Saving a plan does not reserve a room.'); }
    catch { setNotice('Your browser could not save this plan. You can copy this page’s address instead.'); }
  }
  function clear() {
    try { localStorage.removeItem(PLAN_KEY); setSaved(null); setParams({}); setNotice(null); }
    catch { setNotice('We could not remove the saved plan. Please check your browser storage settings.'); }
  }
  return <div className="container page-content"><div className="page-heading"><p className="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO</p><h1>Your stay, <em>taking shape.</em></h1><p>Review your dates and reserve your room, or save the plan for later.</p></div><div className="stay-review"><div><img className="review-image" src={details.image} alt={`Illustrative ${room.name} interior`} width="1000" height="700" /><div className="review-room-title"><h2>{room.name}</h2><Link to={`/rooms/${room.id}?${stayQuery(plan)}`} className="text-link"><ArrowLeft size={16} /> Change details</Link></div><div className="review-facts"><div><span>CHECK-IN</span><strong>{prettyDate(plan.checkIn)}</strong></div><div><span>CHECK-OUT</span><strong>{prettyDate(plan.checkOut)}</strong></div><div><span>YOUR PARTY</span><strong>{plan.guests} guests · 1 room</strong></div></div></div><aside className="plan-card"><p className="eyebrow">YOUR STAY</p><h3>A little closer to <em>away.</em></h3>{problem ? <div className="form-error" role="alert">{problem}<Link className="text-link" to={`/rooms/${room.id}`}>Choose new dates</Link></div> : <><BookingPanel key={`${property.id}:${JSON.stringify(plan)}`} propertyId={property.id} plan={plan} /><div className="save-plan-actions"><button className="text-link" onClick={save}><Heart size={16} />{isSaved ? 'Save plan again' : 'Save plan for later'}</button></div></>}{notice && <p className="notice" role="status">{notice}</p>}{isSaved && <button className="text-link remove-plan" onClick={clear}><Trash2 size={15} /> Remove saved plan</button>}</aside></div></div>;
}

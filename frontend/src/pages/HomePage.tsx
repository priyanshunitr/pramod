import { ArrowDown, ArrowUpRight, BedDouble, Coffee, ConciergeBell, Leaf, Sparkles, Waves, Wifi } from 'lucide-react';
import { Link } from 'react-router';
import { hotel } from '../config/hotel';
import { StaySearch } from '../components/StaySearch';
import { RoomCard } from '../components/RoomCard';
import { CatalogFeedback } from '../components/CatalogFeedback';
import { useCatalog } from '../context/CatalogContext';

export function HomePage() {
  const { property, loading, error } = useCatalog();
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <img className="hero-photo" src={hotel.heroImage} alt="Illustrative hotel pool surrounded by sunlit palm trees" fetchPriority="high" width="2000" height="1333" />
      <div className="hero-shade" />
      <div className="hero-copy"><p className="eyebrow">WELCOME TO {hotel.name.toUpperCase()}</p><h1 id="hero-title">Somewhere to<br /><em>slow down.</em></h1><p>Leave the everyday behind.<br />Make room for a stay that feels like you.</p><a className="hero-discover" href="#rooms">Discover your stay <ArrowDown size={17} /></a></div>
      <div className="hero-caption"><span>THE ART OF FEELING AT HOME</span><span>01 — A DIFFERENT PACE</span></div>
    </section>
    <div className="hero-search container"><StaySearch /><p className="search-note">Start with your dates. Find a room that feels right. <span>Availability is not checked in this preview.</span></p></div>
    <div className="welcome-strip container"><span><BedDouble size={22} strokeWidth={1.3} /> A thoughtful place to rest</span><span><Leaf size={22} strokeWidth={1.3} /> Space to take it slow</span><span><ConciergeBell size={22} strokeWidth={1.3} /> A warmer kind of welcome</span></div>

    <section className="section container" id="rooms" aria-labelledby="rooms-title"><div className="section-heading"><div><p className="eyebrow">YOUR OWN LITTLE RETREAT</p><h2 id="rooms-title">Find your kind of <em>comfort.</em></h2></div><Link to="/rooms" className="text-link">Explore all rooms <ArrowUpRight size={18} /></Link></div>
      <CatalogFeedback />
      {!loading && !error && property && <div className="room-grid">{property.roomTypes.map((room) => <RoomCard key={room.id} room={room} currency={property.currency} />)}</div>}
      {!loading && !error && property?.roomTypes.length === 0 && <p className="empty-state">Our room collection is being prepared. Please check back soon.</p>}
    </section>

    <section className="story-section" id="about" aria-labelledby="story-title"><div className="story-grid container"><div className="story-image"><img src="/images/classic-room.jpg" alt="Illustrative light-filled guest room with warm wooden details" loading="lazy" width="900" height="1000" /><span className="image-caption">THE LITTLE THINGS, THOUGHTFULLY DONE.</span></div><div className="story-copy"><span className="story-symbol" aria-hidden="true"><Sparkles size={34} strokeWidth={1} /></span><p className="eyebrow">MORE THAN A PLACE TO STAY</p><h2 id="story-title">A little pause.<br />A lasting <em>feeling.</em></h2><p>Unhurried mornings. A favourite corner. The simple pleasure of having nowhere else you need to be.</p><p>At {hotel.name}, our idea of a good stay is a simple one: space to settle in, thoughtful details, and a welcome that feels personal.</p><Link to="/gallery" className="text-link">Take a look around <ArrowUpRight size={18} /></Link></div></div></section>

    <section className="section container amenity-section" aria-labelledby="amenity-title"><div className="center-heading"><p className="eyebrow">LITTLE COMFORTS. LOVELY MOMENTS.</p><h2 id="amenity-title">Make yourself <em>at home.</em></h2><p>A glimpse of the experience. Amenities shown are illustrative.</p></div><div className="amenity-grid">{[
      { Icon: Wifi, title: 'Stay connected', description: 'A little work, a favourite playlist, or a call back home.' },
      { Icon: Coffee, title: 'Slow mornings', description: 'Start the day with a warm cup and a moment to yourself.' },
      { Icon: Waves, title: 'Time to unwind', description: 'Blue water, open skies, and an easier pace.' },
      { Icon: ConciergeBell, title: 'A personal touch', description: 'A welcoming team to help you feel settled.' },
    ].map(({ Icon, title, description }) => <article key={title}><Icon size={30} strokeWidth={1.2} /><h3>{title}</h3><p>{description}</p></article>)}</div></section>

    <section className="closing-cta"><div className="container"><div><p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h2>A change of pace<br />looks good <em>on you.</em></h2></div><Link to="/rooms" className="button cream">Find your room <ArrowUpRight size={19} /></Link></div></section>
  </>;
}

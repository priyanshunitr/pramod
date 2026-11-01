import { ArrowDown, ArrowUpRight, Coffee, ConciergeBell, Waves, Wifi } from 'lucide-react';
import { Link } from 'react-router';
import { featuredRooms, formatMoney, hotel } from '../config/hotel';
import { StaySearch } from '../components/StaySearch';
import { Reveal } from '../components/Reveal';
import { ArchitecturalHero } from '../components/ArchitecturalHero';

const rateLabel = (minor: number | null, currency?: string) => minor === null ? 'Rate on request' : `From ${formatMoney(minor / 100, currency)} / night`;

export function HomePage() {
  const rooms = featuredRooms;

  return <div className="hotel-experience">
    <ArchitecturalHero />
    <section className="arrival-search container" id="find-a-stay" aria-label="Find your stay">
      <div className="search-intro"><span className="eyebrow">A FEW DAYS, ALL YOURS.</span><p>Your next pause starts here.</p></div>
      <StaySearch />
      <p className="search-note">Choose your dates to check room availability.</p>
    </section>
    <section className="stay-introduction container" id="about" aria-labelledby="intro-title">
      <div className="section-kicker"><span>/ A different pace</span><span>Stay a little. Feel a lot.</span></div>
      <div className="introduction-grid">
        <Reveal className="introduction-copy">
          <h2 id="intro-title">Stay.<br />Slow.<br />Savour.<br /><span>Repeat.</span></h2>
          <p>Good mornings. Long conversations. Nowhere else you need to be. Welcome to your own little corner of {hotel.name}.</p>
          <Link className="round-link" to="/rooms">Find your kind of comfort <span><ArrowUpRight size={20} /></span></Link>
        </Reveal>
        <Reveal className="room-fan" delay={120}>
          {rooms.map((room, index) => <Link key={room.slug} to={`/rooms/${room.slug}`} className={`fan-card fan-card-${index}`} aria-label={`Explore ${room.name}`}>
            <img src={room.image} alt={`Illustrative ${room.name.toLowerCase()} interior`} width="600" height="450" loading="lazy" />
            <div className="fan-card-caption"><span><strong>{room.name}</strong><small>Up to {room.maxGuests} guests · Your space to unwind</small></span><ArrowUpRight size={21} /></div>
            <div className="fan-card-price">{rateLabel(room.startingRateMinor, room.currency)}</div>
          </Link>)}
          <span className="fan-note">A room for every kind of getaway. <ArrowDown size={14} /></span>
        </Reveal>
      </div>
    </section>
    <section className="room-collection" id="rooms" data-header-tone="light" aria-labelledby="collection-title">
      <div className="container">
        <div className="section-kicker"><h2 id="collection-title">/ The room collection</h2><span>Make yourself at home.</span></div>
        {rooms.map((room, index) => <Reveal key={room.slug} delay={index * 70}>
          <Link to={`/rooms/${room.slug}`} className="collection-row" aria-label={`Explore ${room.name}, ${rateLabel(room.startingRateMinor, room.currency)}`}>
            <span className="collection-index">/ 0{index + 1}</span>
            <div className="collection-name"><h3>{room.name}</h3><p>Up to {room.maxGuests} guests <span>·</span> {rateLabel(room.startingRateMinor, room.currency)}</p></div>
            <img className="collection-preview" src={room.image} alt="" width="320" height="240" loading="lazy" />
            <span className="collection-arrow"><ArrowUpRight size={25} strokeWidth={1.3} /></span>
          </Link>
        </Reveal>)}
        <div className="collection-bottom"><p>A little everyday luxury, at your own pace.</p><Link to="/rooms" className="text-link">See rooms & availability <ArrowUpRight size={18} /></Link></div>
      </div>
    </section>
    <section className="life-at-pramod" data-header-tone="light" aria-labelledby="life-title">
      <img className="life-photo" src={hotel.heroImage} alt="Illustrative palm-lined pool in warm afternoon light" loading="lazy" width="2000" height="1333" />
      <div className="life-shade" />
      <div className="life-content container">
        <div className="section-kicker"><span>/ Life at Pramod</span><span>Little comforts. Lovely moments.</span></div>
        <Reveal className="life-heading"><h2 id="life-title">Less rush.<br />More living.</h2><Link to="/gallery" className="button glass">Take a look around <ArrowUpRight size={18} /></Link></Reveal>
        <div className="comfort-notes">{[
          { Icon: Coffee, title: 'Slow mornings', copy: 'One more cup. No hurry.' },
          { Icon: Waves, title: 'Poolside pauses', copy: 'Make time for doing nothing.' },
          { Icon: Wifi, title: 'Stay connected', copy: 'As much, or as little, as you like.' },
          { Icon: ConciergeBell, title: 'A warm welcome', copy: 'The little things, taken care of.' },
        ].map(({ Icon, title, copy }, index) => <Reveal key={title} className="comfort-note" delay={index * 80}><Icon size={23} strokeWidth={1.4} /><div><h3>{title}</h3><p>{copy}</p></div></Reveal>)}</div>
        <p className="experience-note">A glimpse of the experience · Illustrative amenities and photography</p>
      </div>
    </section>
    <section className="next-stay container"><Reveal><span className="eyebrow">SOMEWHERE YOU’LL WANT TO STAY.</span><Link to="/rooms" className="next-stay-link"><h2>See you soon?</h2><span><ArrowUpRight strokeWidth={1.2} /></span></Link><p>Pick your dates. We’ll help you find your place.</p></Reveal></section>
  </div>;
}

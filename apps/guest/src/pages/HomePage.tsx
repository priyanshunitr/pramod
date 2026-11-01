import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { featuredRooms, formatMoney } from '../config/hotel';
import { Reveal } from '../components/Reveal';
import { ArchitecturalHero } from '../components/ArchitecturalHero';
import { InteriorSection } from '../components/InteriorSection';
import { LifestyleSection } from '../components/LifestyleSection';

const rateLabel = (minor: number | null, currency?: string) => minor === null ? 'Rate on request' : `From ${formatMoney(minor / 100, currency)} / night`;

export function HomePage() {
  const rooms = featuredRooms;

  return <div className="hotel-experience">
    <ArchitecturalHero />
    <InteriorSection />
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
    <LifestyleSection />
    <section className="next-stay container"><Reveal><span className="eyebrow">SOMEWHERE YOU’LL WANT TO STAY.</span><Link to="/rooms" className="next-stay-link"><h2>See you soon?</h2><span><ArrowUpRight strokeWidth={1.2} /></span></Link><p>Pick your dates. We’ll help you find your place.</p></Reveal></section>
  </div>;
}

import { useLayoutEffect, useRef } from 'react';
import { ArrowUpRight, Coffee, ConciergeBell, Waves, Wifi } from 'lucide-react';
import { Link } from 'react-router';
import { featuredRooms, formatMoney, hotel } from '../config/hotel';
import { Reveal } from '../components/Reveal';
import { ArchitecturalHero } from '../components/ArchitecturalHero';
import { InteriorSection } from '../components/InteriorSection';

const rateLabel = (minor: number | null, currency?: string) => minor === null ? 'Rate on request' : `From ${formatMoney(minor / 100, currency)} / night`;

export function HomePage() {
  const rooms = featuredRooms;
  const lifeSectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = lifeSectionRef.current;
    if (!section) return;
    const photo = section.querySelector<HTMLImageElement>('.life-photo')!;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;

    const update = () => {
      frame = 0;
      const bounds = section.getBoundingClientRect();
      // Start at 125% on entry and reach the full view as the section leaves.
      const progress = Math.max(0, Math.min(1,
        (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)));
      photo.style.setProperty('--life-photo-scale', String(reducedMotion.matches ? 1 : 1.25 - progress * .25));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(section);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    void document.fonts.ready.then(() => { if (!disposed) schedule(); });
    update();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
    };
  }, []);

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
    <section className="life-at-pramod" ref={lifeSectionRef} data-header-tone="light" aria-labelledby="life-title">
      <img className="life-photo" src={hotel.lifeImage} alt="Illustrative nighttime villa with a turquoise infinity pool and tropical palms" loading="lazy" width="1672" height="941" />
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

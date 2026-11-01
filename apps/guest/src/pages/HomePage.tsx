import { useLayoutEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
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
    const cardSlots = [...section.querySelectorAll<HTMLElement>('.comfort-entry')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cards: { slot: HTMLElement; top: number; height: number }[] = [];
    let frame = 0;
    let disposed = false;

    const update = () => {
      frame = 0;
      const bounds = section.getBoundingClientRect();
      // Pull back from 220% on entry to the full view while half the section is still visible.
      const progress = Math.max(0, Math.min(1,
        (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height * .5)));
      photo.style.setProperty('--life-photo-scale', String(reducedMotion.matches ? 1 : 2.2 - progress * 1.2));
      cards.forEach(({ slot, top, height }, index) => {
        // The stationary grid slot defines the scroll range, not the moving photo.
        // A small right-column offset staggers the pairs without a time delay.
        const start = window.innerHeight * (.96 - (index % 2) * .035);
        const travel = Math.max(1, Math.min(window.innerHeight * .45, height * 1.4));
        const entered = reducedMotion.matches ? 1 : Math.max(0, Math.min(1,
          (start - (bounds.top + top)) / travel));
        const eased = entered * entered * (3 - 2 * entered);
        slot.style.setProperty('--comfort-outset', String(1 - eased));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      const sectionTop = section.getBoundingClientRect().top;
      cards = cardSlots.map(slot => {
        const bounds = slot.getBoundingClientRect();
        return { slot, top: bounds.top - sectionTop, height: bounds.height };
      });
      cancelAnimationFrame(frame);
      update();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(section);
    cardSlots.forEach(slot => resize.observe(slot));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    reducedMotion.addEventListener('change', schedule);
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
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
        <div className="life-composition">
          <div className="life-heading"><h2 id="life-title">Less rush.<br />More living.</h2><Link to="/gallery" className="button glass">Take a look around <ArrowUpRight size={18} /></Link></div>
          {[
            { image: '/images/classic-room.jpg', alt: 'Illustrative guest room with a comfortable bed', title: 'Slow mornings', copy: 'One more cup. No hurry.' },
            { image: '/images/hotel-pool.jpg', alt: 'Illustrative swimming pool framed by palm trees', title: 'Poolside pauses', copy: 'Make time for doing nothing.' },
            { image: '/images/family-suite.jpg', alt: 'Illustrative suite interior with a spacious bed', title: 'Stay connected', copy: 'As much, or as little, as you like.' },
            { image: '/images/deluxe-room.jpg', alt: 'Illustrative warm, inviting room interior', title: 'A warm welcome', copy: 'The little things, taken care of.' },
          ].map(({ image, alt, title, copy }, index) => <div key={title} className={`comfort-entry comfort-entry-${index + 1}`}>
            <figure className="comfort-note"><img src={image} alt={alt} width="480" height="300" loading="lazy" /><figcaption><h3>{title}</h3><p>{copy}</p></figcaption></figure>
          </div>)}
        </div>
        <p className="experience-note">A glimpse of the experience · Illustrative amenities and photography</p>
      </div>
    </section>
    <section className="next-stay container"><Reveal><span className="eyebrow">SOMEWHERE YOU’LL WANT TO STAY.</span><Link to="/rooms" className="next-stay-link"><h2>See you soon?</h2><span><ArrowUpRight strokeWidth={1.2} /></span></Link><p>Pick your dates. We’ll help you find your place.</p></Reveal></section>
  </div>;
}

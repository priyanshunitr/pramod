import { useLayoutEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { hotel } from '../config/hotel';
import { comfortTransform } from '../lib/lifestyle-motion';

const comforts = [
  { image: '/images/classic-room.jpg', alt: 'Illustrative guest room with a comfortable bed', title: 'Slow mornings', copy: 'One more cup. No hurry.' },
  { image: '/images/hotel-pool.jpg', alt: 'Illustrative swimming pool framed by palm trees', title: 'Poolside pauses', copy: 'Make time for doing nothing.' },
  { image: '/images/family-suite.jpg', alt: 'Illustrative suite interior with a spacious bed', title: 'Stay connected', copy: 'As much, or as little, as you like.' },
  { image: '/images/deluxe-room.jpg', alt: 'Illustrative warm, inviting room interior', title: 'A warm welcome', copy: 'The little things, taken care of.' },
];

export function LifestyleSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const stage = section.querySelector<HTMLElement>('.life-stage')!;
    const photo = section.querySelector<HTMLImageElement>('.life-photo')!;
    const cards = [...section.querySelectorAll<HTMLElement>('.comfort-spinner')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;
    let distance = 0;
    let stageHeight = 0;
    let compact = false;

    const update = () => {
      frame = 0;
      const top = section.getBoundingClientRect().top;
      const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, distance > 0
        ? -top / distance
        : (window.innerHeight - top) / (window.innerHeight + stageHeight)));
      cards.forEach((card, index) => {
        card.style.transform = comfortTransform(progress, index, compact);
      });
      // Keep the existing dramatic pull-back; finish before the cards settle.
      photo.style.setProperty('--life-photo-scale', String(2.2 - Math.min(1, progress / .72) * 1.2));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      stageHeight = stage.getBoundingClientRect().height;
      compact = window.innerWidth <= 900;
      // Short landscape windows keep normal document flow so nothing is trapped.
      const pinned = !reducedMotion.matches && stageHeight <= window.innerHeight + 1;
      distance = pinned ? stageHeight * 1.6 : 0;
      section.style.setProperty('--life-stage-height', `${stageHeight}px`);
      section.style.setProperty('--life-scroll-distance', `${distance}px`);
      section.dataset.scrollMode = reducedMotion.matches ? 'static' : pinned ? 'pinned' : 'flow';
      cancelAnimationFrame(frame);
      update();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    reducedMotion.addEventListener('change', measure);
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      reducedMotion.removeEventListener('change', measure);
    };
  }, []);

  return <section className="life-at-pramod" ref={sectionRef} data-scroll-mode="static" data-header-tone="light" aria-labelledby="life-title">
    <div className="life-stage">
      <img className="life-photo" src={hotel.lifeImage} alt="Illustrative nighttime villa with a turquoise infinity pool and tropical palms" loading="lazy" width="1672" height="941" />
      <div className="life-shade" />
      <div className="life-content container">
        <div className="section-kicker"><span>/ Life at Pramod</span><span>Little comforts. Lovely moments.</span></div>
        <div className="life-composition">
          <div className="life-heading"><h2 id="life-title">Less rush.<br />More living.</h2><Link to="/gallery" className="button glass">Take a look around <ArrowUpRight size={18} /></Link></div>
          {comforts.map(({ image, alt, title, copy }, index) => <div key={title} className={`comfort-flight comfort-flight-${index + 1}`}>
            <div className="comfort-spinner">
              <figure className="comfort-note"><img src={image} alt={alt} width="480" height="300" loading="lazy" /><figcaption><h3>{title}</h3><p>{copy}</p></figcaption></figure>
              <div className="comfort-back" aria-hidden="true"><span>Pramod</span><small>A little moment to keep.</small></div>
            </div>
          </div>)}
        </div>
        <p className="experience-note">A glimpse of the experience · Illustrative amenities and photography</p>
      </div>
    </div>
  </section>;
}

import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { hotel } from '../config/hotel';

export function ArchitecturalHero() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const paint = () => {
      frame = 0;
      const bounds = element.getBoundingClientRect();
      const distance = motion.matches ? 0 : Math.min(Math.max(-bounds.top, 0), bounds.height);
      // Keep the lettering nearly in place as the villa scrolls up over it.
      element.style.setProperty('--hero-depth', `${distance * 0.9}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const configure = () => {
      window.removeEventListener('scroll', schedule);
      if (!motion.matches) window.addEventListener('scroll', schedule, { passive: true });
      schedule();
    };
    configure();
    motion.addEventListener('change', configure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); motion.removeEventListener('change', configure); };
  }, []);

  return <section ref={ref} className="architecture-hero" aria-labelledby="hero-title">
    <div className="hero-wordmark-depth"><h1 id="hero-title" className="hero-wordmark">{hotel.name}<span className="sr-only"> — A place to slow down</span></h1></div>
    <span className="hero-side-note">Stay. Slow.<br />Feel at home.</span>
    <div className="architecture-scene"><img className="architecture-cutout" src="/images/pramod-architecture-v2.webp" alt="An imagined Pramod retreat: a sunlit modern villa framed by palms, overlooking a turquoise pool" fetchPriority="high" width="1672" height="941" /></div>
    <div className="architecture-shade" />
    <div className="hero-bottom"><a className="hero-scroll" href="#about"><span><ArrowDown size={22} strokeWidth={1.5} /></span><span>Step into<br />a slower day.</span></a><div className="hero-bottom-copy"><p>A place to pause.<br />A stay to remember.</p><Link to="/rooms">Find your stay <ArrowUpRight size={17} /></Link></div></div>
  </section>;
}

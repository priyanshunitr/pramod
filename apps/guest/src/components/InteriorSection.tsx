import { useLayoutEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { hotel } from '../config/hotel';
import { InteriorFilmstrip } from './InteriorFilmstrip';

export function InteriorSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const stage = section.querySelector<HTMLElement>('.introduction-stage')!;
    const tracks = [...section.querySelectorAll<HTMLElement>('.filmstrip-track')];
    const staticLayout = window.matchMedia('(prefers-reduced-motion: reduce)');
    let starts: number[] = [];
    let travel: number[] = [];
    let distance = 0;
    let frame = 0;
    let disposed = false;

    const update = () => {
      frame = 0;
      const progress = distance > 0 ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / distance)) : 0;
      tracks.forEach((track, index) => {
        track.style.setProperty('--film-offset', `${-((starts[index] ?? 0) + progress * (travel[index] ?? 0))}px`);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      const pinned = !staticLayout.matches;
      section.dataset.scrollMode = pinned ? 'pinned' : 'static';
      const availableTravel = tracks.map(track => pinned
        ? Math.max(0, track.getBoundingClientRect().height - track.parentElement!.getBoundingClientRect().height)
        : 0);
      const paths = tracks.map((track, index) => {
        const available = availableTravel[index] ?? 0;
        const firstFrame = track.firstElementChild;
        const frameStep = (firstFrame?.getBoundingClientRect().height ?? 0) + (parseFloat(getComputedStyle(track).rowGap) || 0);
        const stagger = Math.min(available, frameStep * Number(track.dataset.startFrame ?? 0));
        if (track.dataset.direction === 'down' && frameStep > 0) {
          // Start near the bottom, aligned half a frame from the other roll.
          // Both endpoints stay inside the track so moving down never exposes a gap.
          const start = stagger + Math.floor((available - stagger) / frameStep) * frameStep;
          return { start, end: 0 };
        }
        return { start: stagger, end: available };
      });
      starts = paths.map(path => path.start);
      travel = paths.map(path => path.end - path.start);
      // Signed travel gives opposite directions; both rolls finish before release.
      distance = Math.max(0, ...travel.map(Math.abs));
      section.style.setProperty('--film-scroll-distance', `${distance}px`);
      cancelAnimationFrame(frame);
      update();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    tracks.forEach(track => resize.observe(track));
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure);
    staticLayout.addEventListener('change', measure);
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
      staticLayout.removeEventListener('change', measure);
    };
  }, []);

  return <section className="stay-introduction" id="about" ref={sectionRef} data-scroll-mode="static" aria-labelledby="intro-title">
    <div className="introduction-stage">
      <div className="introduction-grid container">
        <div className="introduction-copy">
          <p className="introduction-kicker">/ A different pace</p>
          <h2 id="intro-title">Stay.<br /> Slow.<br /> Savour.<br /> <span>Repeat.</span></h2>
          <p>Good mornings. Long conversations. Nowhere else you need to be. Welcome to your own little corner of {hotel.name}.</p>
          <div className="introduction-links">
            <Link className="round-link" to="/rooms">Find your kind of comfort <span><ArrowUpRight size={20} /></span></Link>
            <Link className="text-link" to="/gallery">Explore the interiors <ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <div className="interior-reel"><InteriorFilmstrip /></div>
      </div>
    </div>
  </section>;
}

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { featuredRooms } from '../config/hotel';

export function InteriorFilmstrip() {
  const viewport = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      setCanPrevious(element.scrollLeft > 2);
      setCanNext(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    const resize = new ResizeObserver(update);
    resize.observe(element);
    if (element.firstElementChild) resize.observe(element.firstElementChild);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => { resize.disconnect(); element.removeEventListener('scroll', update); };
  }, []);

  function move(direction: number) {
    const element = viewport.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth * 0.8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return <div className="interior-filmstrip">
    <div className="filmstrip-heading"><span>/ Inside Pramod</span><span>{String(featuredRooms.length).padStart(2, '0')} frames of comfort</span></div>
    <div className="filmstrip-viewport" id="interior-filmstrip" ref={viewport} tabIndex={0} role="region" aria-label="Interior photographs, scroll horizontally">
      <ul className="filmstrip-track">
        {featuredRooms.map((room, index) => <li className="filmstrip-frame" key={room.slug}>
          <figure>
            <img src={room.image} alt={`Illustrative ${room.name.toLowerCase()} interior`} width="600" height="450" loading="lazy" />
            <figcaption><span>{room.name}</span><span aria-hidden="true">{String(index + 1).padStart(2, '0')}A</span></figcaption>
          </figure>
        </li>)}
      </ul>
    </div>
    <div className="filmstrip-footer">
      <Link className="text-link" to="/gallery">Explore the interiors <ArrowUpRight size={16} /></Link>
      <div className="filmstrip-controls" aria-label="Filmstrip controls">
        <button type="button" onClick={() => move(-1)} disabled={!canPrevious} aria-label="Previous interior photos" aria-controls="interior-filmstrip"><ArrowLeft size={18} /></button>
        <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Next interior photos" aria-controls="interior-filmstrip"><ArrowRight size={18} /></button>
      </div>
    </div>
  </div>;
}

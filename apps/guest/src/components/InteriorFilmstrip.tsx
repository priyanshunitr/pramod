import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { featuredRooms } from '../config/hotel';

const interiorRolls = [featuredRooms, [featuredRooms[1], featuredRooms[2], featuredRooms[0]]] as const;

function InteriorRoll({ rooms, number }: { rooms: readonly (typeof featuredRooms)[number][]; number: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      setCanPrevious(element.scrollTop > 2);
      setCanNext(element.scrollTop + element.clientHeight < element.scrollHeight - 2);
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
      top: direction * element.clientHeight * 0.75,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  const id = `interior-roll-${number}`;
  return <div className="filmstrip-roll">
    <div className="filmstrip-viewport" id={id} ref={viewport} tabIndex={0} role="region" aria-label={`Interior roll ${number}, scroll vertically`}>
      <ul className="filmstrip-track">
        {rooms.map((room, index) => <li className="filmstrip-frame" key={room.slug}>
          <figure>
            <img src={room.image} alt={`Illustrative ${room.name.toLowerCase()} interior`} width="600" height="450" loading="lazy" />
            <figcaption><span>{room.name}</span><span aria-hidden="true">{String(index + 1).padStart(2, '0')}{number === 1 ? 'A' : 'B'}</span></figcaption>
          </figure>
        </li>)}
      </ul>
    </div>
    <div className="filmstrip-controls" aria-label={`Roll ${number} controls`}>
      <button type="button" onClick={() => move(-1)} disabled={!canPrevious} aria-label={`Scroll roll ${number} up`} aria-controls={id}><ArrowUp size={18} /></button>
      <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label={`Scroll roll ${number} down`} aria-controls={id}><ArrowDown size={18} /></button>
    </div>
  </div>;
}

export function InteriorFilmstrip() {
  return <div className="interior-filmstrip" id="interior-filmstrip">
    <div className="filmstrip-heading"><span>/ Inside Pramod</span><span>Two rolls. A little escape.</span></div>
    <div className="filmstrip-columns">
      {interiorRolls.map((rooms, index) => <InteriorRoll key={index} rooms={rooms} number={index + 1} />)}
    </div>
    <div className="filmstrip-footer">
      <Link className="text-link" to="/gallery">Explore the interiors <ArrowUpRight size={16} /></Link>
      <span>Little details. A feeling of home.</span>
    </div>
  </div>;
}

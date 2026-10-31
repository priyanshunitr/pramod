import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Expand, X } from 'lucide-react';
import { Link } from 'react-router';

const photos = [
  { src: '/images/hotel-pool.jpg', title: 'The slower side of life', category: 'Outdoors', alt: 'Sunlit swimming pool and tall palms' },
  { src: '/images/classic-room.jpg', title: 'A corner to call your own', category: 'Rooms', alt: 'Welcoming room with a large window and comfortable bed' },
  { src: '/images/deluxe-room.jpg', title: 'Room for a little more', category: 'Rooms', alt: 'Spacious bedroom with soft lighting' },
  { src: '/images/family-suite.jpg', title: 'Thoughtful little details', category: 'Rooms', alt: 'White bedding and warm lamps in an elegant bedroom' },
];

export function GalleryPage() {
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = selected === null ? null : photos[selected];
  useEffect(() => {
    if (selected !== null && !dialog.current?.open) dialog.current?.showModal();
    if (selected === null && dialog.current?.open) dialog.current.close();
  }, [selected]);
  function next(direction: number) { setSelected((value) => value === null ? null : (value + direction + photos.length) % photos.length); }
  return <div className="container page-content"><div className="page-heading"><p className="eyebrow">A GLIMPSE OF THE GOOD LIFE</p><h1>Picture yourself <em>here.</em></h1><p>A visual direction for Pramod. These stock photographs are illustrative, not photographs of the actual hotel.</p></div><div className="gallery-filters" aria-label="Filter photographs">{['All', 'Rooms', 'Outdoors'].map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="gallery-grid">{photos.map((item, index) => (filter === 'All' || filter === item.category) && <button className={`gallery-tile ${index === 0 ? 'wide' : ''}`} key={item.src} onClick={() => setSelected(index)} aria-label={`Open photograph: ${item.title}`}><img src={item.src} alt={item.alt} loading="lazy" width="1200" height="800" /><span className="gallery-caption"><span><small>{item.category}</small>{item.title}</span><Expand size={20} /></span></button>)}</div><div className="gallery-end"><p>Found your favourite corner?</p><Link to="/rooms" className="text-link">Explore the rooms <ArrowUpRight size={18} /></Link></div>
    <dialog className="lightbox" ref={dialog} aria-label="Hotel photograph viewer" onCancel={() => setSelected(null)} onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }} onKeyDown={(event) => { if (event.key === 'ArrowRight') next(1); if (event.key === 'ArrowLeft') next(-1); }}>
      {photo && <div className="lightbox-inner"><button className="icon-button lightbox-close" aria-label="Close photograph" onClick={() => setSelected(null)} autoFocus><X /></button><img src={photo.src} alt={photo.alt} /><div className="lightbox-controls"><button className="icon-button" onClick={() => next(-1)} aria-label="Previous photograph"><ArrowLeft /></button><p>{photo.title}<span>Illustrative photography · {(selected ?? 0) + 1} / {photos.length}</span></p><button className="icon-button" onClick={() => next(1)} aria-label="Next photograph"><ArrowRight /></button></div></div>}
    </dialog>
  </div>;
}

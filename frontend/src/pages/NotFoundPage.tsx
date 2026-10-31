import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage({ room = false }: { room?: boolean }) {
  return <div className="container page-content"><div className="empty-state large"><p className="eyebrow">A SMALL DETOUR</p><h1>{room ? 'This room isn’t here.' : 'A little off the beaten path.'}</h1><p>{room ? 'It may have changed or no longer be in the collection.' : 'We couldn’t find that page. Let’s get you somewhere more comfortable.'}</p><Link className="button primary" to={room ? '/rooms' : '/'}>{room ? 'Explore the rooms' : 'Back to the hotel'} <ArrowUpRight size={18} /></Link></div></div>;
}

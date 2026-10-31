import { RefreshCw } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';

export function CatalogFeedback() {
  const { loading, error, retry } = useCatalog();
  if (loading) return <div className="room-grid" aria-label="Loading rooms" role="status">{[1, 2, 3].map((key) => <div key={key} className="room-skeleton"><div /><span /><span /></div>)}<span className="sr-only">Loading rooms…</span></div>;
  if (error) return <div className="empty-state" role="alert"><h3>A moment, please.</h3><p>{error}</p><button className="button secondary" onClick={retry}>Try again <RefreshCw size={16} /></button></div>;
  return null;
}

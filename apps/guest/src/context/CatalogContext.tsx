import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getProperty, type PropertyCatalog } from '../lib/api';
import { hotel } from '../config/hotel';

interface CatalogState { property: PropertyCatalog | null; loading: boolean; error: string | null; retry: () => void }
const CatalogContext = createContext<CatalogState | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [property, setProperty] = useState<PropertyCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getProperty(hotel.slug, controller.signal).then((value) => {
      if (!controller.signal.aborted) setProperty(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('We couldn’t load the rooms just now. Please try again in a moment.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);
  return <CatalogContext.Provider value={{ property, error, loading, retry: () => setAttempt((value) => value + 1) }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('CatalogProvider is required.');
  return value;
}

import { useEffect, useState } from 'react';
import { api, type Availability } from './api';
import { stayQuery, type StayDates } from './stay';

export function useAvailability(propertyId: string | undefined, stay: StayDates | null) {
  const [attempt, setAttempt] = useState(0);
  const query = stay ? stayQuery(stay) : '';
  const key = `${propertyId}:${query}:${attempt}`;
  const enabled = Boolean(propertyId && stay);
  const [state, setState] = useState<{ key: string; data: Availability | null; error: string | null }>({ key: '', data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api<Availability>(`/properties/${propertyId}/availability?${query}`, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ key, data, error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : 'Could not check availability.' }); });
    return () => controller.abort();
  }, [propertyId, query, key, enabled]);
  return { data: enabled && state.key === key ? state.data : null, error: enabled && state.key === key ? state.error : null,
    loading: enabled && state.key !== key, refresh: () => setAttempt(value => value + 1) };
}

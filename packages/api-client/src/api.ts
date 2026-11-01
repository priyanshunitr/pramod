import type { PropertyCatalog } from '@hotel/contracts';

export const AUTH_REQUIRED_EVENT = 'pramod:auth-required';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json() as { data?: T; error?: string };
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    throw new ApiError(payload.error ?? 'We could not complete this request.', response.status);
  }
  return payload.data as T;
}

export async function getProperty(slug: string, signal: AbortSignal): Promise<PropertyCatalog> {
  const response = await fetch(`/api/properties/${encodeURIComponent(slug)}`, { signal });
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'The demo hotel has not been added yet. Run the database seed to get started.'
      : 'We could not load the hotel. Check that the API and database are running.');
  }
  const payload = await response.json() as { data: PropertyCatalog };
  return payload.data;
}

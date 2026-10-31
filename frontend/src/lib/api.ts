export interface PropertyCatalog {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  roomTypes: { id: string; name: string; description: string; maxGuests: number }[];
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

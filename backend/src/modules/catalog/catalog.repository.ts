import { pool } from '../../db/pool.js';

export interface RoomType {
  id: string;
  name: string;
  description: string;
  maxGuests: number;
}

export interface PropertyCatalog {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  roomTypes: RoomType[];
}

export async function getPropertyCatalog(slug: string): Promise<PropertyCatalog | null> {
  const property = await pool.query<Omit<PropertyCatalog, 'roomTypes'>>(
    'SELECT id, name, slug, currency, timezone FROM properties WHERE slug = $1', [slug],
  );
  const row = property.rows[0];
  if (!row) return null;

  const roomTypes = await pool.query<RoomType>(
    'SELECT id, name, description, max_guests AS "maxGuests" FROM room_types WHERE property_id = $1 ORDER BY max_guests, name',
    [row.id],
  );
  return { ...row, roomTypes: roomTypes.rows };
}

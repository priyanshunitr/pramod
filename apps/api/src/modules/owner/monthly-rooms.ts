import { z } from 'zod';
import type { OwnerBookedRooms } from '@hotel/contracts';
import { transaction } from '../../db/transaction.js';
import { HttpError, parse, uuid } from '../../lib/http.js';
import { requireRole } from '../staff/permissions.js';

export const monthlyRoomsQuery = z.object({
  month: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, 'Choose a valid month.')
    .refine(value => Number(value.slice(0, 4)) < 9999, 'Choose a year before 9999.'),
  roomTypeId: uuid.optional(),
}).strict();

export async function monthlyBookedRooms(propertyId: string, actorId: string, input: unknown): Promise<OwnerBookedRooms> {
  const query = parse(monthlyRoomsQuery, input);
  return transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await requireRole(propertyId, actorId, true, client);
    const property = (await client.query<{ timezone: string }>('SELECT timezone FROM properties WHERE id = $1', [propertyId])).rows[0];
    if (!property) throw new HttpError(404, 'Hotel not found.');
    if (query.roomTypeId && !(await client.query('SELECT 1 FROM room_types WHERE property_id = $1 AND id = $2', [propertyId, query.roomTypeId])).rowCount) {
      throw new HttpError(404, 'Room type not found for this hotel.');
    }
    // Keep completed stays even after checkout releases their allocation. This is
    // the booked stay schedule, not booking creation dates or measured occupancy.
    const days = (await client.query<OwnerBookedRooms['days'][number]>(`
      WITH nights AS (
        SELECT ($2::date + i)::date AS date
        FROM generate_series(0, (($2::date + interval '1 month')::date - $2::date) - 1) AS i
      ), stays AS (
        SELECT DISTINCT r.id, r.number, b.check_in, b.check_out
        FROM bookings b
        JOIN booking_rooms br ON br.booking_id = b.id AND br.property_id = b.property_id
        JOIN rooms r ON r.id = br.room_id AND r.property_id = b.property_id
        WHERE b.property_id = $1 AND b.status <> 'cancelled'
          AND b.check_in < $2::date + interval '1 month' AND b.check_out > $2::date
          AND ($3::uuid IS NULL OR r.room_type_id = $3)
      )
      SELECT n.date::text AS date, count(DISTINCT s.id)::int AS "bookedRooms",
        COALESCE(array_agg(DISTINCT s.number ORDER BY s.number) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::text[]) AS "roomNumbers"
      FROM nights n LEFT JOIN stays s ON s.check_in <= n.date AND s.check_out > n.date
      GROUP BY n.date ORDER BY n.date`, [propertyId, `${query.month}-01`, query.roomTypeId ?? null])).rows;
    return { month: query.month, timezone: property.timezone, roomTypeId: query.roomTypeId ?? null, days };
  });
}

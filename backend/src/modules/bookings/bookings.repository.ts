import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { transaction } from '../../db/transaction.js';
import { HttpError } from '../../lib/http.js';
import { digest } from '../auth/security.js';
import { audit, lockProperty, requireRole } from '../staff/permissions.js';
import { hotelToday, nightCount, validateStay, type Stay } from './stay.js';

type Queryable = Pick<PoolClient, 'query'>;
interface Property { id: string; timezone: string; currency: string; }
export interface Booking {
  id: string; propertyId: string; customerId: string; roomTypeId: string;
  roomTypeName: string; checkIn: string; checkOut: string; guests: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  nightlyRateMinor: number; totalMinor: number; currency: string; roomNumber: string;
}
const bookingSelect = `SELECT b.id, b.property_id AS "propertyId", b.customer_id AS "customerId",
  b.room_type_id AS "roomTypeId", t.name AS "roomTypeName", b.check_in::text AS "checkIn", b.check_out::text AS "checkOut",
  b.guests, b.status, b.nightly_rate_minor AS "nightlyRateMinor", b.total_minor::float8 AS "totalMinor", b.currency,
  r.number AS "roomNumber" FROM bookings b JOIN room_types t ON t.id = b.room_type_id
  JOIN booking_rooms br ON br.booking_id = b.id JOIN rooms r ON r.id = br.room_id`;

async function getProperty(propertyId: string, db: Queryable = pool): Promise<Property> {
  const result = await db.query<Property>('SELECT id, timezone, currency FROM properties WHERE id = $1', [propertyId]);
  if (!result.rows[0]) throw new HttpError(404, 'Hotel not found.');
  return result.rows[0];
}

export async function availability(propertyId: string, stay: Stay) {
  const property = await getProperty(propertyId);
  validateStay(stay, property.timezone);
  const result = await pool.query<{ id: string; name: string; maxGuests: number; nightlyRateMinor: number; availableRooms: number }>(`
    SELECT t.id, t.name, t.max_guests AS "maxGuests", t.nightly_rate_minor AS "nightlyRateMinor", count(r.id)::int AS "availableRooms"
    FROM room_types t LEFT JOIN rooms r ON r.room_type_id = t.id AND r.property_id = t.property_id
      AND r.operational_status = 'active' AND NOT EXISTS (
        SELECT 1 FROM booking_rooms br WHERE br.room_id = r.id AND br.active
        AND daterange(br.check_in, br.check_out, '[)') && daterange($2::date, $3::date, '[)'))
    WHERE t.property_id = $1 AND t.max_guests >= $4 AND t.nightly_rate_minor IS NOT NULL
    GROUP BY t.id ORDER BY t.max_guests, t.name`, [propertyId, stay.checkIn, stay.checkOut, stay.guests]);
  return { ...stay, nights: nightCount(stay), currency: property.currency, roomTypes: result.rows.map(room => ({ ...room, totalMinor: room.nightlyRateMinor * nightCount(stay) })) };
}

export async function listBookings(customerId: string): Promise<Booking[]> {
  return (await pool.query<Booking>(`${bookingSelect} WHERE b.customer_id = $1 ORDER BY b.created_at DESC LIMIT 100`, [customerId])).rows;
}
export async function listHotelBookings(propertyId: string, actorId: string) {
  await requireRole(propertyId, actorId);
  return (await pool.query<Booking & { customerName: string; customerEmail: string }>(`${bookingSelect.replace('SELECT b.id,', 'SELECT u.full_name AS "customerName", u.email AS "customerEmail", b.id,')}
    JOIN users u ON u.id = b.customer_id WHERE b.property_id = $1 ORDER BY b.check_in DESC, b.created_at DESC LIMIT 100`, [propertyId])).rows;
}

export interface BookingInput extends Stay { roomTypeId: string; expectedTotalMinor: number; currency: string; idempotencyKey: string; }
export async function createBooking(propertyId: string, customerId: string, data: BookingInput) {
  // Canonical field order prevents a retry from changing the reservation silently.
  const requestHash = digest(JSON.stringify([propertyId, data.roomTypeId, data.checkIn, data.checkOut, data.guests, data.expectedTotalMinor, data.currency]));
  return transaction(async client => {
    // A retry must return the original booking, even if it is now cancelled.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${customerId}:${data.idempotencyKey}`]);
    const previous = await client.query<{ id: string; request_hash: string }>('SELECT id, request_hash FROM bookings WHERE customer_id = $1 AND idempotency_key = $2', [customerId, data.idempotencyKey]);
    if (previous.rows[0]) {
      if (previous.rows[0].request_hash !== requestHash) throw new HttpError(409, 'This booking request was already used for different details.');
      return { booking: (await client.query<Booking>(`${bookingSelect} WHERE b.id = $1`, [previous.rows[0].id])).rows[0]!, created: false };
    }
    const property = await getProperty(propertyId, client);
    validateStay(data, property.timezone);
    // Serialize allocation per room type, then re-read inventory in this transaction.
    const roomType = await client.query<{ max_guests: number; nightly_rate_minor: number | null }>('SELECT max_guests, nightly_rate_minor FROM room_types WHERE property_id = $1 AND id = $2 FOR UPDATE', [propertyId, data.roomTypeId]);
    const type = roomType.rows[0];
    if (!type) throw new HttpError(404, 'Room type not found.');
    if (data.guests > type.max_guests) throw new HttpError(400, 'This room cannot accommodate that many guests.');
    if (type.nightly_rate_minor === null) throw new HttpError(409, 'This room does not have a configured rate.');
    const total = type.nightly_rate_minor * nightCount(data);
    if (total !== data.expectedTotalMinor || property.currency !== data.currency) throw new HttpError(409, 'The price has changed. Refresh availability and review the new total.');
    const rooms = await client.query<{ id: string }>(`SELECT r.id FROM rooms r WHERE r.property_id = $1 AND r.room_type_id = $2
      AND r.operational_status = 'active' AND NOT EXISTS (SELECT 1 FROM booking_rooms br WHERE br.room_id = r.id AND br.active
        AND daterange(br.check_in, br.check_out, '[)') && daterange($3::date, $4::date, '[)'))
      ORDER BY r.number LIMIT 1 FOR UPDATE OF r`, [propertyId, data.roomTypeId, data.checkIn, data.checkOut]);
    if (!rooms.rows[0]) throw new HttpError(409, 'These dates are no longer available. Please choose another room or stay.');
    const created = await client.query<{ id: string }>(`INSERT INTO bookings(property_id, customer_id, room_type_id, check_in, check_out, guests, nightly_rate_minor, total_minor, currency, idempotency_key, request_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [propertyId, customerId, data.roomTypeId, data.checkIn, data.checkOut, data.guests, type.nightly_rate_minor, total, property.currency, data.idempotencyKey, requestHash]);
    const id = created.rows[0]!.id;
    await client.query('INSERT INTO booking_rooms(booking_id, property_id, room_id, check_in, check_out) VALUES ($1, $2, $3, $4, $5)', [id, propertyId, rooms.rows[0].id, data.checkIn, data.checkOut]);
    await client.query("INSERT INTO notification_outbox(booking_id, event) VALUES ($1, 'booking.confirmed')", [id]);
    return { booking: (await client.query<Booking>(`${bookingSelect} WHERE b.id = $1`, [id])).rows[0]!, created: true };
  });
}

export async function transitionBooking(id: string, actorId: string, action: 'cancel' | 'check-in' | 'check-out', propertyId?: string) {
  await transaction(async client => {
    if (propertyId) {
      await lockProperty(client, propertyId);
      await requireRole(propertyId, actorId, false, client);
    }
    const result = await client.query<{ property_id: string; customer_id: string; status: string; check_in: string; check_out: string; timezone: string }>(`
      SELECT b.property_id, b.customer_id, b.status, b.check_in::text, b.check_out::text, p.timezone
      FROM bookings b JOIN properties p ON p.id = b.property_id WHERE b.id = $1 FOR UPDATE OF b`, [id]);
    const booking = result.rows[0];
    if (!booking || (propertyId ? booking.property_id !== propertyId : booking.customer_id !== actorId)) throw new HttpError(404, 'Booking not found.');
    if (!propertyId && action !== 'cancel') throw new HttpError(403, 'Staff access is required.');
    const today = hotelToday(booking.timezone);
    if (action === 'cancel') {
      if (booking.status === 'cancelled') return;
      if (booking.status !== 'confirmed') throw new HttpError(409, 'Only a reservation awaiting check-in can be cancelled.');
      if (!propertyId && booking.check_in < today) throw new HttpError(409, 'Contact reception to change a past reservation.');
    } else if (action === 'check-in') {
      if (booking.status !== 'confirmed' || today < booking.check_in || today >= booking.check_out) throw new HttpError(409, 'Check-in is available only during the reserved stay dates.');
      const dirty = await client.query(`SELECT 1 FROM booking_rooms br JOIN rooms r ON r.id = br.room_id
        WHERE br.booking_id = $1 AND (r.housekeeping_status <> 'clean' OR r.operational_status <> 'active')`, [id]);
      if (dirty.rowCount) throw new HttpError(409, 'The assigned room must be clean and in service before check-in.');
      const occupied = await client.query(`SELECT 1 FROM booking_rooms mine JOIN booking_rooms other ON other.room_id = mine.room_id
        JOIN bookings b ON b.id = other.booking_id WHERE mine.booking_id = $1 AND b.id <> $1 AND b.status = 'checked_in'`, [id]);
      if (occupied.rowCount) throw new HttpError(409, 'The previous guest must check out before this room can be checked in.');
    } else if (booking.status !== 'checked_in') throw new HttpError(409, 'Only a checked-in stay can be checked out.');
    const status = action === 'cancel' ? 'cancelled' : action === 'check-in' ? 'checked_in' : 'checked_out';
    await client.query('UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
    if (action !== 'check-in') await client.query('UPDATE booking_rooms SET active = false WHERE booking_id = $1', [id]);
    if (action === 'check-out') await client.query("UPDATE rooms SET housekeeping_status = 'dirty' WHERE id IN (SELECT room_id FROM booking_rooms WHERE booking_id = $1)", [id]);
    if (action === 'cancel') await client.query("INSERT INTO notification_outbox(booking_id, event) VALUES ($1, 'booking.cancelled') ON CONFLICT DO NOTHING", [id]);
    await audit(client, booking.property_id, actorId, `booking.${status}`, id);
  });
}

import type { OwnerBooking, OwnerDashboard, OwnerRoom } from '@hotel/contracts';
import { transaction } from '../../db/transaction.js';
import { HttpError } from '../../lib/http.js';
import { hotelToday } from '../bookings/stay.js';
import { requireRole } from '../staff/permissions.js';

const dayMs = 86400000;
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10);
const overlaps = (booking: { checkIn: string; checkOut: string }, from: string, to: string) => booking.checkIn < to && booking.checkOut > from;

export async function ownerDashboard(propertyId: string, actorId: string, query: { from?: string; to?: string; roomTypeId?: string }): Promise<OwnerDashboard> {
  return transaction(async client => {
    // All cards, room rows, and daily totals describe one consistent database snapshot.
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await requireRole(propertyId, actorId, true, client);
    const property = (await client.query<OwnerDashboard['property']>('SELECT id, name, timezone, currency FROM properties WHERE id = $1', [propertyId])).rows[0];
    if (!property) throw new HttpError(404, 'Hotel not found.');
    const today = hotelToday(property.timezone);
    const from = query.from ?? today;
    const to = query.to ?? addDays(from, 7);
    const nights = (Date.parse(to) - Date.parse(from)) / dayMs;
    if (from < today || nights < 1 || nights > 30) throw new HttpError(400, 'Choose 1–30 nights, starting today or later.');
    const roomTypes = (await client.query<{ id: string; name: string }>('SELECT id, name FROM room_types WHERE property_id = $1 ORDER BY name', [propertyId])).rows;
    if (query.roomTypeId && !roomTypes.some(type => type.id === query.roomTypeId)) throw new HttpError(404, 'Room type not found for this hotel.');
    const roomRows = (await client.query<Omit<OwnerRoom, 'status' | 'reservations'>>(`
      SELECT r.id, r.number, r.room_type_id AS "roomTypeId", t.name AS "roomTypeName",
        r.housekeeping_status AS "housekeepingStatus", r.operational_status AS "operationalStatus",
        EXISTS (SELECT 1 FROM booking_rooms br JOIN bookings b ON b.id = br.booking_id
          WHERE br.room_id = r.id AND b.status = 'checked_in') AS occupied
      FROM rooms r JOIN room_types t ON t.id = r.room_type_id AND t.property_id = r.property_id
      WHERE r.property_id = $1 AND ($2::uuid IS NULL OR r.room_type_id = $2)
      ORDER BY r.number, r.id`, [propertyId, query.roomTypeId ?? null])).rows;
    const bookings = (await client.query<OwnerBooking>(`
      SELECT b.id, b.property_id AS "propertyId", b.room_type_id AS "roomTypeId", t.name AS "roomTypeName",
        b.check_in::text AS "checkIn", b.check_out::text AS "checkOut", b.guests, b.status,
        b.nightly_rate_minor AS "nightlyRateMinor", b.total_minor::float8 AS "totalMinor", b.currency,
        r.id AS "roomId", r.number AS "roomNumber", br.active AS "allocationActive",
        u.full_name AS "customerName", u.email AS "customerEmail"
      FROM bookings b JOIN booking_rooms br ON br.booking_id = b.id AND br.property_id = b.property_id
      JOIN rooms r ON r.id = br.room_id JOIN room_types t ON t.id = b.room_type_id
      JOIN users u ON u.id = b.customer_id
      WHERE b.property_id = $1 AND ($2::uuid IS NULL OR b.room_type_id = $2)
        AND ((b.check_in < $4::date AND b.check_out > $3::date)
          OR b.check_in = $5::date OR b.check_out = $5::date OR b.status = 'checked_in')
      ORDER BY b.check_in, r.number, b.id`, [propertyId, query.roomTypeId ?? null, from, to, today])).rows;

    const rooms: OwnerRoom[] = roomRows.map(room => {
      const reservations = bookings.filter(booking => booking.roomId === room.id && booking.allocationActive && overlaps(booking, from, to))
        .map(({ id, checkIn, checkOut, status }) => ({ id, checkIn, checkOut, status }));
      return { ...room, reservations, status: room.operationalStatus === 'out_of_service' ? 'out_of_service' : reservations.length ? 'reserved' : 'available' };
    });
    const periodBookings = bookings.filter(booking => overlaps(booking, from, to));
    const values = new Map<string, number>();
    for (const booking of periodBookings.filter(booking => booking.status !== 'cancelled')) {
      // Value is limited to reserved nights in this window, not the entire stay or collected cash.
      const nightsInPeriod = (Date.parse(booking.checkOut < to ? booking.checkOut : to) - Date.parse(booking.checkIn > from ? booking.checkIn : from)) / dayMs;
      values.set(booking.currency, (values.get(booking.currency) ?? 0) + nightsInPeriod * booking.nightlyRateMinor);
    }
    const inService = rooms.filter(room => room.operationalStatus === 'active');
    const occupiedInService = inService.filter(room => room.occupied).length;
    const summary: OwnerDashboard['summary'] = {
      totalRooms: rooms.length, inServiceRooms: inService.length,
      occupiedRooms: rooms.filter(room => room.occupied).length, occupiedInServiceRooms: occupiedInService,
      occupancyPercent: inService.length ? Math.round(occupiedInService / inService.length * 1000) / 10 : null,
      availableRooms: rooms.filter(room => room.status === 'available').length,
      outOfServiceRooms: rooms.length - inService.length,
      arrivalsToday: bookings.filter(booking => booking.checkIn === today && booking.status !== 'cancelled').length,
      departuresToday: bookings.filter(booking => booking.checkOut === today && booking.status !== 'cancelled').length,
      reservations: periodBookings.length,
      confirmed: periodBookings.filter(booking => booking.status === 'confirmed').length,
      checkedIn: periodBookings.filter(booking => booking.status === 'checked_in').length,
      checkedOut: periodBookings.filter(booking => booking.status === 'checked_out').length,
      cancelled: periodBookings.filter(booking => booking.status === 'cancelled').length,
      bookingValueByCurrency: [...values].map(([currency, amountMinor]) => ({ currency, amountMinor })).sort((a, b) => a.currency.localeCompare(b.currency)),
      readiness: { clean: inService.filter(room => room.housekeepingStatus === 'clean').length,
        dirty: inService.filter(room => room.housekeepingStatus === 'dirty').length,
        cleaning: inService.filter(room => room.housekeepingStatus === 'cleaning').length },
    };
    const daily = Array.from({ length: nights }, (_, index) => {
      const date = addDays(from, index);
      const reservedRooms = inService.filter(room => room.reservations.some(booking => overlaps(booking, date, addDays(date, 1)))).length;
      return { date, reservedRooms, availableRooms: inService.length - reservedRooms, outOfServiceRooms: summary.outOfServiceRooms };
    });
    return { property, today, from, to, generatedAt: new Date().toISOString(), roomTypes, summary, daily, rooms, bookings };
  });
}

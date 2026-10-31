import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerBooking, OwnerDashboard } from '@hotel/contracts';
import { selectBookings } from '../src/filters.ts';

function booking(id: string, checkIn: string, checkOut: string, status: OwnerBooking['status'] = 'confirmed'): OwnerBooking {
  return { id, checkIn, checkOut, status, propertyId: 'hotel', roomTypeId: 'suite', roomTypeName: 'Suite', roomId: id,
    roomNumber: id, guests: 1, nightlyRateMinor: 100, totalMinor: 200, currency: 'INR', allocationActive: status === 'confirmed', customerName: 'Sample Guest', customerEmail: 'sample@example.test' };
}
const report = { today: '2026-11-01', from: '2026-11-05', to: '2026-11-08', bookings: [
  booking('arrives', '2026-11-01', '2026-11-02'), booking('departs', '2026-10-30', '2026-11-01', 'checked_out'),
  booking('overdue', '2026-10-28', '2026-10-31', 'checked_in'), booking('inside', '2026-11-05', '2026-11-07'),
  booking('cancelled', '2026-11-05', '2026-11-07', 'cancelled'), booking('boundary', '2026-11-08', '2026-11-09'),
] } as OwnerDashboard;

test('stay-window drilldowns use half-open dates and include cancelled reservations', () => {
  assert.deepEqual(selectBookings(report, 'period', '').map(item => item.id), ['inside', 'cancelled']);
  assert.deepEqual(selectBookings(report, 'value', '').map(item => item.id), ['inside']);
  assert.deepEqual(selectBookings(report, 'cancelled', '').map(item => item.id), ['cancelled']);
});
test('today and in-house drilldowns remain independent of the selected future window', () => {
  assert.deepEqual(selectBookings(report, 'arrivals', '').map(item => item.id), ['arrives']);
  assert.deepEqual(selectBookings(report, 'departures', '').map(item => item.id), ['departs']);
  assert.deepEqual(selectBookings(report, 'inhouse', '').map(item => item.id), ['overdue']);
});
test('room links select an exact reservation and search is case-insensitive', () => {
  assert.deepEqual(selectBookings(report, 'period', '', 'overdue').map(item => item.id), ['overdue']);
  assert.equal(selectBookings(report, 'period', '  SAMPLE@EXAMPLE.TEST  ').length, 2);
  assert.equal(selectBookings(report, 'period', 'nobody').length, 0);
});

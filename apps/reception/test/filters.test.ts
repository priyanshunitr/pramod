import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Booking } from '@hotel/api-client';
import { inReservationScope } from '../src/filters.ts';

const today = '2026-11-02';
const stay = (status: Booking['status'], checkIn = today, checkOut = '2026-11-03') => ({ status, checkIn, checkOut }) as Booking;
test('arrivals include completed arrivals but exclude cancellations', () => {
  assert.equal(inReservationScope(stay('checked_in'), 'arrivals', today), true);
  assert.equal(inReservationScope(stay('cancelled'), 'arrivals', today), false);
  assert.equal(inReservationScope(stay('confirmed', '2026-11-03'), 'arrivals', today), false);
});
test('departure view retains overdue in-house guests and today’s completed departures', () => {
  assert.equal(inReservationScope(stay('checked_in', '2026-10-29', '2026-11-01'), 'departures', today), true);
  assert.equal(inReservationScope(stay('checked_out', '2026-10-29', today), 'departures', today), true);
  assert.equal(inReservationScope(stay('checked_out', '2026-10-29', '2026-11-01'), 'departures', today), false);
  assert.equal(inReservationScope(stay('cancelled', '2026-10-29', today), 'departures', today), false);
});

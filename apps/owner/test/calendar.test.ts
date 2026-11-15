import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerRoom } from '@hotel/contracts';
import { calendarSegments } from '../src/calendar.ts';

const room: OwnerRoom = { id: 'room-101', number: '101', roomTypeId: 'classic', roomTypeName: 'Classic Room',
  operationalStatus: 'active', occupied: false, status: 'reserved', reservations: [
    { id: 'first-stay', checkIn: '2026-11-14', checkOut: '2026-11-18', status: 'confirmed' },
    { id: 'next-stay', checkIn: '2026-11-18', checkOut: '2026-11-20', status: 'confirmed' },
  ] };

test('joins the nights of one stay but keeps a checkout-day arrival separate', () => {
  const dates = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'];
  const segments = calendarSegments(room, dates);
  assert.deepEqual(segments.map(({ from, lastNight, nights, booking }) => [from, lastNight, nights, booking?.id]), [
    ['2026-11-15', '2026-11-17', 3, 'first-stay'],
    ['2026-11-18', '2026-11-19', 2, 'next-stay'],
    ['2026-11-20', '2026-11-20', 1, undefined],
    ['2026-11-21', '2026-11-21', 1, undefined],
  ]);
  assert.equal(segments.reduce((sum, segment) => sum + segment.nights, 0), dates.length);
});

test('clips a stay to the visible window, including a month boundary', () => {
  const spanning = { ...room, reservations: [{ id: 'long-stay', checkIn: '2026-10-28', checkOut: '2026-11-04', status: 'checked_in' as const }] };
  const segments = calendarSegments(spanning, ['2026-10-31', '2026-11-01', '2026-11-02']);
  assert.equal(segments.length, 1);
  assert.equal(segments[0]!.nights, 3);
  assert.equal(segments[0]!.booking!.checkOut, '2026-11-04');
  assert.equal(segments[0]!.lastNight, '2026-11-02');
});

test('preserves offline status, single-night cells and gaps between displayed dates', () => {
  const segments = calendarSegments({ ...room, operationalStatus: 'out_of_service' }, ['2026-11-15', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
  assert.deepEqual(segments.map(segment => segment.nights), [1, 1, 2, 1]);
  assert.ok(segments.every(segment => segment.state === 'out-of-service'));
  assert.equal(segments[2]!.booking!.id, 'next-stay');
  assert.equal(segments[3]!.booking, undefined);
  assert.deepEqual(calendarSegments(room, []), []);
});

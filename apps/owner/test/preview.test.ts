import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerBookedRooms, OwnerDashboard, StaffNotifications } from '@hotel/contracts';
import { createPreviewStore } from '../../../packages/ui/src/preview.ts';

test('sample check-in and checkout update occupancy and release allocations without network access', async () => {
  const store = createPreviewStore('2026-11-02');
  const base = `/properties/${store.property.id}`;
  const before = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  const arrival = before.bookings.find(booking => booking.checkIn === before.today && booking.status === 'confirmed')!;
  await store.request(`${base}/bookings/${arrival.id}/check-in`, {});
  const after = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  assert.equal(after.summary.occupiedRooms, before.summary.occupiedRooms + 1);
  await store.request(`${base}/bookings/${arrival.id}/check-out`, {});
  const departed = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  assert.equal(departed.rooms.find(room => room.id === arrival.roomId)?.occupied, false);
  assert.equal(departed.summary.occupiedRooms, before.summary.occupiedRooms);
  assert.equal(departed.bookings.find(booking => booking.id === arrival.id)?.allocationActive, false);
  assert.equal(before.bookings.find(booking => booking.id === arrival.id)?.status, 'confirmed', 'read snapshots are detached from store mutations');
});

test('sample data keeps checkout boundaries, role restrictions and invalid actions honest', async () => {
  const store = createPreviewStore('2026-11-02');
  const base = `/properties/${store.property.id}`;
  const report = await store.request<OwnerDashboard>(`${base}/owner/dashboard?from=2026-11-02&to=2026-11-03`);
  assert.equal(report.rooms.find(room => room.number === '101')?.status, 'available');
  assert.equal(report.rooms.find(room => room.number === '101')?.occupied, true, 'current occupancy is separate from scheduled inventory');
  await assert.rejects(store.request(`${base}/bookings/PR-1049/check-in`, {}), /not eligible/);
  await assert.rejects(store.request(`${base}/staff/members/owner/revoke`, {}), /retain at least one owner/);
  await assert.rejects(store.request('/auth/login', {}), /not available/);
  await assert.rejects(store.request(`${base}/staff/invitations`, { email: 'owner@example.test', role: 'owner' }), /Only receptionists/);
});

test('owner preview request notifications clear after review', async () => {
  for (const decision of ['approved', 'rejected']) {
    const store = createPreviewStore('2026-11-02');
    const base = `/properties/${store.property.id}/staff`;
    assert.equal((await store.request<StaffNotifications>(`${base}/notifications`)).pendingCount, 1);
    await store.request(`${base}/requests/request-1/review`, { decision });
    assert.equal((await store.request<StaffNotifications>(`${base}/notifications`)).pendingCount, 0);
    const team = await store.request<{ members: { email: string }[] }>(`${base}/team`);
    assert.equal(team.members.some(member => member.email === 'aditi@example.test'), decision === 'approved');
  }
});

test('monthly preview includes completed stays, excludes checkout and cancellations, and returns complete months', async () => {
  const store = createPreviewStore('2024-03-01');
  const base = `/properties/${store.property.id}/owner/booked-rooms`;
  const february = await store.request<OwnerBookedRooms>(`${base}?month=2024-02`);
  assert.equal(february.days.length, 29);
  assert.ok(february.days[28]!.roomNumbers.includes('106'), 'completed stay remains in historical counts');
  assert.ok(february.days.every(day => day.bookedRooms === new Set(day.roomNumbers).size));
  const march = await store.request<OwnerBookedRooms>(`${base}?month=2024-03`);
  assert.equal(march.days.length, 31);
  assert.ok(!march.days[0]!.roomNumbers.includes('106'), 'checkout date is not a booked night');
  assert.ok(march.days.every(day => !day.roomNumbers.includes('304')), 'cancelled stay is excluded');
  const suites = await store.request<OwnerBookedRooms>(`${base}?month=2024-03&roomTypeId=suite`);
  assert.ok(suites.days.every(day => day.roomNumbers.every(number => number.startsWith('3'))));
  const empty = await store.request<OwnerBookedRooms>(`${base}?month=2025-02`);
  assert.equal(empty.days.length, 28); assert.ok(empty.days.every(day => day.bookedRooms === 0));
  await assert.rejects(store.request(`${base}?month=2024-13`), /valid month/);
});

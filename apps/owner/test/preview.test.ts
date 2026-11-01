import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnerDashboard } from '@hotel/contracts';
import { createPreviewStore } from '../../../packages/ui/src/preview.ts';

test('sample workspace mutations update reports and room readiness without network access', async () => {
  const store = createPreviewStore('2026-11-02');
  const base = `/properties/${store.property.id}`;
  const before = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  const arrival = before.bookings.find(booking => booking.checkIn === before.today && booking.status === 'confirmed')!;
  await store.request(`${base}/bookings/${arrival.id}/check-in`, {});
  const after = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  assert.equal(after.summary.occupiedRooms, before.summary.occupiedRooms + 1);
  await store.request(`${base}/bookings/${arrival.id}/check-out`, {});
  const departed = await store.request<OwnerDashboard>(`${base}/owner/dashboard`);
  assert.equal(departed.rooms.find(room => room.id === arrival.roomId)?.housekeepingStatus, 'dirty');
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
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, dateValue, nights, stayFromParams, stayQuery, validateStay } from '../src/lib/stay.ts';

const today = '2026-10-31';
const stay = { checkIn: '2026-11-07', checkOut: '2026-11-09', guests: 2 };

test('rejects impossible calendar dates instead of letting Date normalize them', () => {
  assert.equal(dateValue('2026-02-30'), null);
  assert.equal(dateValue('2026-02-29'), null);
  assert.notEqual(dateValue('2028-02-29'), null);
  assert.equal(dateValue('2026-13-01'), null);
});

test('counts room nights using calendar dates across daylight-saving changes', () => {
  assert.equal(nights({ checkIn: '2026-03-07', checkOut: '2026-03-09', guests: 1 }), 2);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('rejects past check-in, equal dates, and backwards stays', () => {
  assert.match(validateStay({ ...stay, checkIn: '2026-10-30' }, today)!, /today or later/);
  assert.match(validateStay({ ...stay, checkOut: stay.checkIn }, today)!, /after check-in/);
  assert.match(validateStay({ ...stay, checkOut: '2026-11-06' }, today)!, /after check-in/);
});

test('rejects fractional, missing, and excessive guest counts from URL parameters', () => {
  for (const guests of [0, 1.5, 7, Number.NaN]) {
    assert.match(validateStay({ ...stay, guests }, today)!, /between 1 and 6/);
  }
});

test('accepts a normal stay and rejects a stay beyond the preview limit', () => {
  assert.equal(validateStay(stay, today), null);
  assert.match(validateStay({ ...stay, checkOut: '2026-12-10' }, today)!, /up to 30 nights/);
});

test('preserves dates and guests through shareable URLs', () => {
  assert.deepEqual(stayFromParams(new URLSearchParams(stayQuery(stay)), today), stay);
  assert.deepEqual(stayFromParams(new URLSearchParams(), today), stay);
});

export interface StayDates { checkIn: string; checkOut: string; guests: number }
export interface StayPlan extends StayDates { roomId: string }
export const PLAN_KEY = 'hotel.stay-plan.v1';

export function todayAtHotel(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dateValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

export function addDays(value: string, days: number) {
  const timestamp = dateValue(value);
  return timestamp === null ? '' : new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

export function nights(stay: StayDates) {
  const start = dateValue(stay.checkIn);
  const end = dateValue(stay.checkOut);
  return start === null || end === null ? 0 : Math.max(0, (end - start) / 86_400_000);
}

export function validateStay(stay: StayDates, today: string) {
  if (dateValue(stay.checkIn) === null || dateValue(stay.checkOut) === null) return 'Choose valid check-in and check-out dates.';
  if (stay.checkIn < today) return 'Choose a check-in date today or later.';
  if (stay.checkOut <= stay.checkIn) return 'Check-out must be after check-in.';
  if (nights(stay) > 30) return 'For this preview, choose a stay of up to 30 nights.';
  if (!Number.isInteger(stay.guests) || stay.guests < 1 || stay.guests > 6) return 'Choose between 1 and 6 guests.';
  return null;
}

export function stayFromParams(params: URLSearchParams, today: string): StayDates {
  return { checkIn: params.get('checkIn') ?? addDays(today, 7), checkOut: params.get('checkOut') ?? addDays(today, 9), guests: Number(params.get('guests') ?? 2) };
}

export function stayQuery(stay: StayDates) {
  return new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) }).toString();
}

export function prettyDate(value: string) {
  const timestamp = dateValue(value);
  return timestamp === null ? 'Choose a date' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(timestamp);
}

export function readSavedPlan(): StayPlan | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const plan = value as Partial<StayPlan>;
    if (typeof plan.roomId !== 'string' || typeof plan.checkIn !== 'string' || typeof plan.checkOut !== 'string' || typeof plan.guests !== 'number') return null;
    if (dateValue(plan.checkIn) === null || dateValue(plan.checkOut) === null || !Number.isInteger(plan.guests) || plan.guests < 1 || plan.guests > 6) return null;
    return plan as StayPlan;
  } catch { return null; }
}

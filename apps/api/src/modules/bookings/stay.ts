import { z } from 'zod';
import { HttpError } from '../../lib/http.js';

export const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid calendar date.').refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');

export const staySchema = z.object({ checkIn: dateValue, checkOut: dateValue, guests: z.coerce.number().int().min(1).max(6) });
export type Stay = z.infer<typeof staySchema>;
export const nightCount = (stay: Stay) => (Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86400000;
export function hotelToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  return ['year', 'month', 'day'].map(name => parts.find(part => part.type === name)!.value).join('-');
}
export function validateStay(stay: Stay, timezone: string): void {
  if (stay.checkIn < hotelToday(timezone)) throw new HttpError(400, 'Check-in cannot be in the past.');
  if (nightCount(stay) < 1 || nightCount(stay) > 30) throw new HttpError(400, 'Choose a stay between 1 and 30 nights.');
}

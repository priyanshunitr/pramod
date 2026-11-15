import type { OwnerRoom } from '@hotel/contracts';

interface CalendarSegment {
  from: string;
  lastNight: string;
  nights: number;
  state: 'available' | 'reserved' | 'out-of-service';
  booking?: OwnerRoom['reservations'][number];
}

export function calendarSegments(room: OwnerRoom, dates: string[]): CalendarSegment[] {
  const segments: CalendarSegment[] = [];
  for (const date of dates) {
    const booking = room.reservations.find(stay => stay.checkIn <= date && stay.checkOut > date);
    const state = room.operationalStatus === 'out_of_service' ? 'out-of-service' : booking ? 'reserved' : 'available';
    const previous = segments.at(-1);
    // Only a continuous reservation spans columns; adjacent bookings stay distinct.
    if (booking && previous?.booking?.id === booking.id && previous.state === state
      && Date.parse(date) - Date.parse(previous.lastNight) === 86400000) {
      previous.lastNight = date;
      previous.nights++;
    } else {
      segments.push({ from: date, lastNight: date, nights: 1, state, booking });
    }
  }
  return segments;
}

import type { Booking } from '@hotel/api-client';

export const reservationScopes = ['arrivals', 'departures', 'inhouse', 'all', 'confirmed', 'cancelled'] as const;
export type ReservationScope = typeof reservationScopes[number];
export function inReservationScope(booking: Booking, scope: ReservationScope, today: string) {
  switch (scope) {
    case 'all': return true;
    case 'arrivals': return booking.checkIn === today && booking.status !== 'cancelled';
    case 'departures': return (booking.checkOut === today && booking.status !== 'cancelled') || (booking.checkOut < today && booking.status === 'checked_in');
    case 'inhouse': return booking.status === 'checked_in';
    default: return booking.status === scope;
  }
}

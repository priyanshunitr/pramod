import type { OwnerBooking, OwnerDashboard } from '@hotel/contracts';

export function selectBookings(report: OwnerDashboard, scope: string, search: string, bookingId = ''): OwnerBooking[] {
  const term = search.trim().toLowerCase();
  return report.bookings.filter(booking => {
    if (bookingId && booking.id !== bookingId) return false;
    const overlaps = booking.checkIn < report.to && booking.checkOut > report.from;
    const inScope = bookingId ? true : scope === 'arrivals' ? booking.checkIn === report.today && booking.status !== 'cancelled'
      : scope === 'departures' ? booking.checkOut === report.today && booking.status !== 'cancelled'
      : scope === 'inhouse' ? booking.status === 'checked_in'
      : scope === 'value' ? overlaps && booking.status !== 'cancelled'
      : ['confirmed', 'checked_in', 'checked_out', 'cancelled'].includes(scope) ? overlaps && booking.status === scope : overlaps;
    return inScope && (!term || [booking.id, booking.customerName, booking.customerEmail, booking.roomNumber, booking.roomTypeName].some(value => value?.toLowerCase().includes(term)));
  });
}

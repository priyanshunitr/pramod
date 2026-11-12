import type { Booking, OwnerBooking, OwnerBookedRooms, OwnerDashboard, OwnerRoom, PropertyCatalog, StaffBookingAvailability, StaffBookingInput } from '@hotel/contracts';
import type { api } from '@hotel/api-client';
import { ApiError } from '@hotel/api-client/error';
import { addDays, todayAtHotel } from './format.ts';

export interface StaffRoom { id: string; number: string; operationalStatus: 'active' | 'out_of_service'; }
const active = (booking: Booking) => booking.status === 'confirmed' || booking.status === 'checked_in';
const overlaps = (booking: Booking, from: string, to: string) => booking.checkIn < to && booking.checkOut > from;

export function createPreviewStore(today = todayAtHotel('Asia/Kolkata')) {
  const property: PropertyCatalog = { id: 'preview-pramod', name: 'Pramod', slug: 'preview', currency: 'INR', timezone: 'Asia/Kolkata', roomTypes: [
    { id: 'classic', name: 'Classic Room', description: 'A quiet place to settle in.', maxGuests: 2, nightlyRateMinor: 450000 },
    { id: 'deluxe', name: 'Deluxe Room', description: 'A little more room to unwind.', maxGuests: 2, nightlyRateMinor: 650000 },
    { id: 'suite', name: 'Family Suite', description: 'Space for everyone.', maxGuests: 4, nightlyRateMinor: 950000 },
  ] };
  const rooms: (StaffRoom & { roomTypeId: string; roomTypeName: string })[] = Array.from({ length: 18 }, (_, i) => {
    const type = property.roomTypes[Math.floor(i / 6)]!;
    return { id: `room-${i + 1}`, number: `${Math.floor(i / 6) + 1}0${i % 6 + 1}`, roomTypeId: type.id, roomTypeName: type.name,
      operationalStatus: i === 17 ? 'out_of_service' : 'active' };
  });
  const guests = ['Aarav Mehta', 'Diya Kapoor', 'Rohan Shah', 'Ananya Rao', 'Kabir Sethi', 'Meera Nair', 'Arjun Desai', 'Isha Verma', 'Vihaan Joshi', 'Sara Khan', 'Aditya Bose', 'Naina Patel'];
  const stays: [number, number, number, Booking['status']][] = [
    [0, -2, 0, 'checked_in'], [1, -1, 2, 'checked_in'], [6, -3, 0, 'checked_in'], [7, -1, 3, 'checked_in'], [12, -2, 2, 'checked_in'],
    [2, 0, 3, 'confirmed'], [8, 0, 2, 'confirmed'], [13, 0, 4, 'confirmed'], [3, 1, 4, 'confirmed'], [9, 2, 6, 'confirmed'],
    [14, 3, 5, 'confirmed'], [15, 1, 3, 'cancelled'], [5, -2, 0, 'checked_out'], [0, 2, 5, 'confirmed'], [6, 4, 7, 'confirmed'],
  ];
  const bookings: OwnerBooking[] = stays.map(([roomIndex, start, end, status], i) => {
    const room = rooms[roomIndex]!; const type = property.roomTypes.find(type => type.id === room.roomTypeId)!;
    const name = guests[i % guests.length]!;
    return { id: `PR-${String(1041 + i)}`, propertyId: property.id, roomId: room.id, roomNumber: room.number, roomTypeId: type.id, roomTypeName: type.name,
      customerName: name, customerEmail: `${name.toLowerCase().replace(' ', '.')}@example.test`, checkIn: addDays(today, start), checkOut: addDays(today, end),
      guests: type.id === 'suite' ? 4 : 2, status, allocationActive: active({ status } as Booking), nightlyRateMinor: type.nightlyRateMinor!, totalMinor: type.nightlyRateMinor! * (end - start), currency: 'INR' };
  });
  let members = [{ id: 'owner', fullName: 'Pramod Owner', email: 'owner@example.test', role: 'owner' }, { id: 'reception-1', fullName: 'Kavya Sharma', email: 'kavya@example.test', role: 'receptionist' }, { id: 'reception-2', fullName: 'Dev Malhotra', email: 'dev@example.test', role: 'receptionist' }];
  let requests = [{ id: 'request-1', fullName: 'Aditi Sen', email: 'aditi@example.test', introduction: 'Joining the front desk team for the evening shift.' }];

  function report(from: string, to: string, roomTypeId: string): OwnerDashboard {
    const selectedRooms = rooms.filter(room => !roomTypeId || room.roomTypeId === roomTypeId);
    const selectedBookings = bookings.filter(booking => !roomTypeId || booking.roomTypeId === roomTypeId);
    const inService = selectedRooms.filter(room => room.operationalStatus === 'active');
    const current = selectedBookings.filter(booking => booking.status === 'checked_in');
    const occupiedInService = inService.filter(room => current.some(booking => booking.roomId === room.id)).length;
    const windowBookings = selectedBookings.filter(booking => overlaps(booking, from, to));
    const mapped: OwnerRoom[] = selectedRooms.map(room => ({ ...room, occupied: current.some(booking => booking.roomId === room.id),
      status: room.operationalStatus === 'out_of_service' ? 'out_of_service' : selectedBookings.some(booking => booking.roomId === room.id && active(booking) && overlaps(booking, from, to)) ? 'reserved' : 'available',
      reservations: selectedBookings.filter(booking => booking.roomId === room.id && active(booking) && overlaps(booking, from, to)).map(({ id, checkIn, checkOut, status }) => ({ id, checkIn, checkOut, status })) }));
    const nights = Math.max(1, Math.min(30, (Date.parse(to) - Date.parse(from)) / 86400000));
    const daily = Array.from({ length: nights }, (_, i) => {
      const date = addDays(from, i);
      const reservedRooms = inService.filter(room => selectedBookings.some(booking => booking.roomId === room.id && active(booking) && overlaps(booking, date, addDays(date, 1)))).length;
      return { date, reservedRooms, availableRooms: inService.length - reservedRooms, outOfServiceRooms: selectedRooms.length - inService.length };
    });
    const amountMinor = windowBookings.filter(booking => booking.status !== 'cancelled').reduce((total, booking) => total + booking.nightlyRateMinor * ((Math.min(Date.parse(to), Date.parse(booking.checkOut)) - Math.max(Date.parse(from), Date.parse(booking.checkIn))) / 86400000), 0);
    return { property, today, from, to, generatedAt: new Date().toISOString(), roomTypes: property.roomTypes, rooms: mapped, daily, bookings: selectedBookings,
      summary: { totalRooms: selectedRooms.length, inServiceRooms: inService.length, occupiedRooms: current.length, occupiedInServiceRooms: occupiedInService,
        occupancyPercent: inService.length ? Math.round(occupiedInService / inService.length * 100) : null, availableRooms: mapped.filter(room => room.status === 'available').length,
        outOfServiceRooms: selectedRooms.length - inService.length, arrivalsToday: selectedBookings.filter(booking => booking.checkIn === today && booking.status !== 'cancelled').length,
        departuresToday: selectedBookings.filter(booking => booking.checkOut === today && booking.status !== 'cancelled').length, reservations: windowBookings.length,
        confirmed: windowBookings.filter(booking => booking.status === 'confirmed').length, checkedIn: windowBookings.filter(booking => booking.status === 'checked_in').length,
        checkedOut: windowBookings.filter(booking => booking.status === 'checked_out').length, cancelled: windowBookings.filter(booking => booking.status === 'cancelled').length,
        bookingValueByCurrency: amountMinor ? [{ currency: 'INR', amountMinor }] : [] } };
  }
  const staffAttempts = new Map<string, { fingerprint: string; bookingId: string }>();
  function staffRooms(checkIn: string, checkOut: string, guests: number): StaffBookingAvailability {
    const nights = (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000;
    if (!Number.isFinite(nights) || checkIn < today || nights < 1 || nights > 30 || !Number.isInteger(guests) || guests < 1 || guests > 6) throw new ApiError('Choose valid dates and 1–6 guests.', 400);
    return { nights, currency: property.currency, rooms: rooms.flatMap(room => {
      const type = property.roomTypes.find(type => type.id === room.roomTypeId)!;
      if (room.operationalStatus !== 'active' || type.maxGuests < guests || type.nightlyRateMinor === null
        || bookings.some(booking => booking.roomId === room.id && active(booking) && overlaps(booking, checkIn, checkOut))) return [];
      return [{ roomId: room.id, roomNumber: room.number, roomTypeId: type.id, roomTypeName: type.name, maxGuests: type.maxGuests,
        nightlyRateMinor: type.nightlyRateMinor, totalMinor: type.nightlyRateMinor * nights }];
    }) };
  }
  const request: typeof api = async <T,>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    signal?.throwIfAborted();
    const url = new URL(path, 'https://preview.invalid');
    const route = url.pathname.replace(`/properties/${property.id}`, '');
    const input = (body ?? {}) as Record<string, string>;
    let result: unknown;
    if (route === '/staff/booking-availability' && body === undefined) {
      result = staffRooms(url.searchParams.get('checkIn') || '', url.searchParams.get('checkOut') || '', Number(url.searchParams.get('guests')));
    } else if (route === '/staff/bookings' && body !== undefined) {
      const data = body as StaffBookingInput;
      const fingerprint = JSON.stringify([data.roomId, data.roomTypeId, data.checkIn, data.checkOut, data.guests,
        data.expectedTotalMinor, data.currency, data.guest.fullName, data.guest.email ?? null, data.guest.phone ?? null]);
      const previous = staffAttempts.get(data.idempotencyKey);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ApiError('This booking request was already used for different details.', 409);
        result = bookings.find(booking => booking.id === previous.bookingId);
      } else {
        if (data.guest.fullName.trim().length < 2 || (!data.guest.email && !data.guest.phone)) throw new ApiError('Add the guest name and a phone number or email.', 400);
        const room = staffRooms(data.checkIn, data.checkOut, data.guests).rooms.find(room => room.roomId === data.roomId && room.roomTypeId === data.roomTypeId);
        if (!room) throw new ApiError('These dates are no longer available. Please choose another room or stay.', 409);
        if (room.totalMinor !== data.expectedTotalMinor || property.currency !== data.currency) throw new ApiError('The price has changed. Refresh availability and review the new total.', 409);
        const booking: OwnerBooking = { id: crypto.randomUUID(), propertyId: property.id, roomId: room.roomId, roomNumber: room.roomNumber,
          roomTypeId: room.roomTypeId, roomTypeName: room.roomTypeName, checkIn: data.checkIn, checkOut: data.checkOut, guests: data.guests,
          status: 'confirmed', allocationActive: true, nightlyRateMinor: room.nightlyRateMinor, totalMinor: room.totalMinor, currency: property.currency,
          customerName: data.guest.fullName, customerEmail: data.guest.email ?? null, customerPhone: data.guest.phone ?? null, bookedByName: 'Sample hotel team' };
        bookings.push(booking); staffAttempts.set(data.idempotencyKey, { fingerprint, bookingId: booking.id }); result = booking;
      }
    } else if (/^\/staff\/bookings\/[^/]+$/.test(route) && body === undefined) {
      result = bookings.find(booking => booking.id === route.split('/')[3]);
      if (!result) throw new ApiError('Reservation not found.', 404);
    } else if (route === '/owner/dashboard' && body === undefined) {
      result = report(url.searchParams.get('from') || today, url.searchParams.get('to') || addDays(today, 7), url.searchParams.get('roomTypeId') || '');
    } else if (route === '/owner/booked-rooms' && body === undefined) {
      const month = url.searchParams.get('month') ?? '';
      if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) >= 9999) throw new Error('Choose a valid month.');
      const roomTypeId = url.searchParams.get('roomTypeId');
      if (roomTypeId && !property.roomTypes.some(type => type.id === roomTypeId)) throw new Error('Room type not found for this hotel.');
      const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
      result = { month, timezone: property.timezone, roomTypeId, days: Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const booked = rooms.filter(room => (!roomTypeId || room.roomTypeId === roomTypeId) && bookings.some(booking => booking.roomId === room.id && booking.status !== 'cancelled' && booking.checkIn <= date && booking.checkOut > date));
        return { date, bookedRooms: booked.length, roomNumbers: booked.map(room => room.number).sort() };
      }) } satisfies OwnerBookedRooms;
    } else if (route === '/bookings' && body === undefined) result = bookings;
    else if (route === '/staff/rooms' && body === undefined) result = rooms;
    else if (route === '/staff/notifications' && body === undefined) result = { pendingCount: requests.length };
    else if (route === '/availability' && body === undefined) {
      const from = url.searchParams.get('checkIn') || today; const to = url.searchParams.get('checkOut') || addDays(today, 1);
      const snapshot = report(from, to, ''); const nights = (Date.parse(to) - Date.parse(from)) / 86400000;
      result = { nights, currency: 'INR', roomTypes: property.roomTypes.filter(type => type.maxGuests >= Number(url.searchParams.get('guests') || 1)).map(type => ({ ...type, totalMinor: type.nightlyRateMinor! * nights, availableRooms: snapshot.rooms.filter(room => room.roomTypeId === type.id && room.status === 'available').length })) };
    } else if (/^\/bookings\/[^/]+\/(check-in|check-out|cancel)$/.test(route) && body !== undefined) {
      const [, , id, action] = route.split('/'); const booking = bookings.find(booking => booking.id === id);
      if (!booking) throw new Error('Reservation not found.');
      const room = rooms.find(room => room.id === booking.roomId)!;
      if (action === 'check-in') {
        if (booking.status !== 'confirmed' || booking.checkIn > today || booking.checkOut <= today) throw new Error('This reservation is not eligible for check-in today.');
        if (room.operationalStatus !== 'active' || bookings.some(other => other.id !== id && other.roomId === room.id && other.status === 'checked_in')) throw new Error('The room must be in service and vacant before check-in.');
        booking.status = 'checked_in';
      } else if (action === 'check-out') {
        if (booking.status !== 'checked_in') throw new Error('Only checked-in guests can check out.');
        booking.status = 'checked_out';
      } else { if (booking.status !== 'confirmed') throw new Error('Only confirmed reservations can be cancelled.'); booking.status = 'cancelled'; }
      booking.allocationActive = active(booking); result = { updated: true };
    } else if (route === '/staff/team' && body === undefined) result = { members, requests };
    else if (/^\/staff\/requests\/[^/]+\/review$/.test(route) && body !== undefined) {
      const pending = requests.find(item => item.id === route.split('/')[3]);
      if (!pending) throw new Error('This request has already been reviewed.');
      if (input.decision === 'approved') members.push({ ...pending, role: 'receptionist' });
      requests = requests.filter(item => item.id !== pending.id); result = { updated: true };
    } else if (/^\/staff\/members\/[^/]+\/revoke$/.test(route) && body !== undefined) {
      const id = route.split('/')[3];
      if (members.find(member => member.id === id)?.role === 'owner' && members.filter(member => member.role === 'owner').length === 1) throw new Error('The hotel must retain at least one owner.');
      members = members.filter(member => member.id !== id); result = { revoked: true };
    } else if (route === '/staff/invitations' && body !== undefined) {
      if (input.role !== 'receptionist') throw new Error('Only receptionists can be invited. Owner accounts are provided by the hotel setup team.');
      result = { token: 'SAMPLE-INVITATION-ONLY-NOT-VALID-FOR-HOTEL-ACCESS', expiresAt: addDays(today, 7) };
    }
    else throw new Error('This action is not available in the sample workspace.');
    return structuredClone(result) as T;
  };
  return { property, request };
}

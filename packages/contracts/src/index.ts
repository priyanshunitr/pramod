export interface PropertyCatalog {
  id: string; name: string; slug: string; currency: string; timezone: string;
  roomTypes: { id: string; name: string; description: string; maxGuests: number; nightlyRateMinor: number | null }[];
}

export interface Session {
  user: { id: string; email: string; fullName: string } | null;
  memberships: { propertyId: string; propertyName: string; slug: string; role: 'owner' | 'receptionist' }[];
  expiresAt: string | null;
}

export interface StaffAccess {
  role: 'owner' | 'receptionist' | null;
  accessRevoked: boolean;
  request: { id: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; reviewedAt: string | null } | null;
}

export interface StaffNotifications {
  pendingCount: number;
}

export interface Booking {
  id: string; propertyId: string; roomTypeId: string; roomTypeName: string;
  checkIn: string; checkOut: string; guests: number; roomNumber: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  nightlyRateMinor: number; totalMinor: number; currency: string;
  customerName?: string; customerEmail?: string;
}

export interface Availability {
  nights: number; currency: string;
  roomTypes: { id: string; name: string; maxGuests: number; nightlyRateMinor: number; totalMinor: number; availableRooms: number }[];
}

export interface OwnerBooking extends Booking { roomId: string; allocationActive: boolean; }
export interface OwnerRoom {
  id: string; number: string; roomTypeId: string; roomTypeName: string;
  housekeepingStatus: 'clean' | 'dirty' | 'cleaning';
  operationalStatus: 'active' | 'out_of_service';
  occupied: boolean;
  status: 'available' | 'reserved' | 'out_of_service';
  reservations: { id: string; checkIn: string; checkOut: string; status: Booking['status'] }[];
}

export interface OwnerDashboard {
  property: { id: string; name: string; timezone: string; currency: string };
  today: string; from: string; to: string; generatedAt: string;
  roomTypes: { id: string; name: string }[];
  summary: {
    totalRooms: number; inServiceRooms: number; occupiedRooms: number; occupiedInServiceRooms: number;
    occupancyPercent: number | null; availableRooms: number; outOfServiceRooms: number;
    arrivalsToday: number; departuresToday: number;
    reservations: number; confirmed: number; checkedIn: number; checkedOut: number; cancelled: number;
    bookingValueByCurrency: { currency: string; amountMinor: number }[];
    readiness: { clean: number; dirty: number; cleaning: number };
  };
  daily: { date: string; reservedRooms: number; availableRooms: number; outOfServiceRooms: number }[];
  rooms: OwnerRoom[];
  bookings: OwnerBooking[];
}

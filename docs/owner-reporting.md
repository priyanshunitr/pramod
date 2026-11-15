# Owner reporting contract

`GET /api/properties/:propertyId/owner/dashboard` requires an active owner membership for the requested hotel. The API rechecks membership on every request and returns `Cache-Control: no-store`. Receptionists and customers cannot read it. All queries run in one read-only, repeatable-read transaction.

Optional parameters: `from` (inclusive), `to` (exclusive), and `roomTypeId`. Dates must be real calendar dates, begin today or later in the hotel's timezone, and span 1–30 nights. The default is today through seven nights later. A room-type filter applies to all metrics and details and must belong to this hotel.

| Metric | Definition |
| --- | --- |
| Current occupancy | Distinct in-service rooms with a currently checked-in booking / all in-service rooms. Null if there are no in-service rooms. It is independent of the selected future dates. |
| Occupied rooms | All rooms with a checked-in booking, including overdue departures. An out-of-service occupied room is still visible, but excluded from the occupancy denominator and numerator. |
| Available rooms | In-service rooms with no active allocation overlapping any night in the selected window. |
| Daily outlook | Reserved and available in-service rooms for each night. Out-of-service rooms are listed separately. This is the current reservation schedule, not historical actual occupancy. |
| Arrivals / departures today | Noncancelled stays scheduled to begin / end today in the hotel's timezone, including already completed arrivals / departures. |
| Reservations | All stays overlapping the selected window, with a status breakdown including cancellations. |
| Booking value | Agreed nightly rate × reserved nights intersecting the window, for noncancelled bookings. Values are grouped by currency, never combined across currencies. This is scheduled booking value, not payments collected or recognized revenue. An early checkout does not rewrite the original agreed stay. |

Room rows expose current occupancy separately from future allocation. Date ranges are half-open: a checkout on a date allows a new check-in on that date. Cancelled and checked-out allocations no longer block availability. Reservations in the response cover the selected window, today's arrivals/departures, and current checked-in stays so every metric can link to its underlying records without the reception list's 100-row limit.

The room calendar joins consecutive nights belonging to the same reservation into one clickable bar. Bars are clipped to the selected window and show the number of visible nights. Adjacent reservations remain separate even when their dates touch; checkout nights are not included. Available and out-of-service dates retain their individual cells, and an out-of-service room's reservations keep their offline styling.

Staff-created reservations count in the same metrics and calendars as customer reservations. Their guest name and contact details come from the booking snapshot, and the reservation details identify the creating staff member. A guest account is not required.

## Monthly booked rooms

`GET /api/properties/:propertyId/owner/booked-rooms?month=YYYY-MM` provides a full calendar month, including zero-booking days. Past and future months are supported independently of the dashboard's 1–30-night stay window. Optional `roomTypeId` applies the selected room-type filter; it must belong to the hotel. The endpoint requires current owner membership and uses a read-only, repeatable-read transaction with `Cache-Control: no-store`.

Each day returns `date`, `bookedRooms`, and `roomNumbers`. A physical room counts once for each night within the original `[check_in, check_out)` stay dates. Cancelled bookings are excluded. Completed stays remain counted after checkout deactivates their allocation; a room's current maintenance status does not erase its history. The report contains room numbers, not guest names or contact details.

The owner overview displays one bar per day with a separate month selector. Hover, keyboard focus, or tap shows the date, total, and room numbers. Escape dismisses the details. Long months scroll horizontally on smaller screens. The month is retained in the URL, while the room-type filter applies to the chart. The summary adds daily counts as **room nights**, not unique reservations.

This measures the booked stay schedule, not the date a reservation was created or actual historical occupancy. Early checkout does not rewrite the original agreed stay. Worker queue metrics, delivery alerts, actual historical occupancy, payments, and financial settlement remain outside this version. No migration is needed: reports derive from existing reservations, allocations, rooms, and staff memberships.

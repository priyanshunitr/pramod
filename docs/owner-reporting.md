# Owner reporting contract

`GET /api/properties/:propertyId/owner/dashboard` requires an active owner membership for the requested hotel. The API rechecks membership on every request and returns `Cache-Control: no-store`. Receptionists and customers cannot read it. All queries run in one read-only, repeatable-read transaction.

Optional parameters: `from` (inclusive), `to` (exclusive), and `roomTypeId`. Dates must be real calendar dates, begin today or later in the hotel's timezone, and span 1–30 nights. The default is today through seven nights later. A room-type filter applies to all metrics and details and must belong to this hotel.

| Metric | Definition |
| --- | --- |
| Current occupancy | Distinct in-service rooms with a currently checked-in booking / all in-service rooms. Null if there are no in-service rooms. It is independent of the selected future dates. |
| Occupied rooms | All rooms with a checked-in booking, including overdue departures. An out-of-service occupied room is still visible, but excluded from the occupancy denominator and numerator. |
| Available rooms | In-service rooms with no active allocation overlapping any night in the selected window. Housekeeping readiness is a separate current state. |
| Daily outlook | Reserved and available in-service rooms for each night. Out-of-service rooms are listed separately. This is the current reservation schedule, not historical actual occupancy. |
| Arrivals / departures today | Noncancelled stays scheduled to begin / end today in the hotel's timezone, including already completed arrivals / departures. |
| Reservations | All stays overlapping the selected window, with a status breakdown including cancellations. |
| Booking value | Agreed nightly rate × reserved nights intersecting the window, for noncancelled bookings. Values are grouped by currency, never combined across currencies. This is scheduled booking value, not payments collected or recognized revenue. An early checkout does not rewrite the original agreed stay. |
| Room readiness | Current clean / dirty / cleaning counts for in-service rooms. |

Room rows expose current occupancy and housekeeping separately from future allocation. Date ranges are half-open: a checkout on a date allows a new check-in on that date. Cancelled and checked-out allocations no longer block availability. Reservations in the response cover the selected window, today's arrivals/departures, and current checked-in stays so every metric can link to its underlying records without the reception list's 100-row limit.

Worker queue metrics, delivery alerts, historical occupancy, payments, and financial settlement are outside this version. No migration is needed: reports derive from existing reservations, allocations, rooms, and staff memberships.

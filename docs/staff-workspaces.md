# Pramod staff workspaces

The reception and owner apps remain independent React frontends in the Turborepo. They share the workspace shell, access gates, reservation details, team controls and visual styles from `packages/ui`.

## Reception

1. Sign in with an approved receptionist or owner account. Accounts without membership can accept a receptionist invitation or request reception access. Owner accounts are provisioned privately by the setup team; the owner website only offers sign-in.
2. The front desk shows expected arrivals, departures due today or overdue, and currently checked-in stays.
3. Open an arrivals/departures/in-house view, or search reservations by guest, email, phone, room or reference.
4. Open a reservation to review dates, guest count, assigned room and agreed value. Check-in appears only during an eligible stay; the API additionally verifies vacancy, room service status and permissions. Check-out releases the room allocation. Cancellation requires an explicit confirmation.
5. Use availability to check a 1–30-night stay and guest capacity. Room types show live counts, nightly rates and full stay values. **Book for a guest** carries that stay into the booking form. Availability is not an inventory hold.
6. Choose **New reservation** (`/book`) to enter a guest's name and at least one contact method (phone or email), choose stay dates and guests, and check availability. Select an individual room, review its whole-stay value, then confirm. The success page links directly to the reservation for check-in when the guest arrives.

Reception uses the existing latest-100 reservation endpoint. If that limit is reached, the UI explicitly scopes totals to the loaded list. Direct reservation links load the selected reservation separately, so newly confirmed stays remain reachable beyond the list limit. Owner reports do not have this list limit.

### Booking on behalf of a guest

Owners and receptionists share the same booking form and property-scoped API. Guests do not need an account. Migration `006_staff_reservations.sql` allows a booking to contain either a customer account or a guest snapshot with a staff creator. Matching a supplied email never creates or links an account. Staff can see the guest's contact details and who made the reservation; customer account lists still show only self-booked reservations.

`GET /api/properties/:propertyId/staff/booking-availability` returns individual available rooms, capacities and server quotes. `POST /api/properties/:propertyId/staff/bookings` rechecks active staff membership, dates, capacity, operational status, exact room and agreed price in a transaction. A property lock serializes membership changes and room allocation; room-type locks and PostgreSQL exclusion constraints protect against competing customer or staff reservations. Retries use an actor-scoped idempotency key and reject changed payloads. A lost response keeps the form frozen with the same details and key for **Retry confirmation** while the page remains open. Reservations create an audit event and notification-outbox record; notification delivery and payment collection remain deferred.

### Speech in reservation search

The microphone beside reservation search (on the front desk and Reservations pages) fills the field as you speak. Say a guest name, email, room number, or reservation reference. Stop recording to edit the text normally. Speech replaces the current query after the first recognized words; failure before recognition preserves the previous query. Search respects the selected reservation view and the latest-100 list. It does not create or change a reservation.

Set `DEEPGRAM_API_KEY` in the ignored root `.env` and run the API as well as the reception frontend. Keep the key server-only; never use a `VITE_` variable. The browser asks for microphone permission after a click and streams audio through the authenticated API WebSocket. Express connects to Deepgram with the private key, forwards interim/final text, and handles provider billing/credential failures. Deepgram billing or credits must be active. The configured Nova-3 multilingual model auto-detects speech, including English and Hindi; see the [Deepgram language documentation](https://developers.deepgram.com/docs/nova-3-language-prompting).

The microphone stops on Stop, navigation, hidden tab, permission/device failure, connection failure, or the two-minute limit. An unfinished microphone prompt can be cancelled. Final recorder bytes are sent before the server asks Deepgram to [close the stream and flush remaining words](https://developers.deepgram.com/docs/close-stream). Audio and search text are not saved by Pramod. Audio is processed by Deepgram while recording; its data handling terms apply. Sample previews disable speech and never contact Deepgram.

`GET /api/properties/:propertyId/staff/speech/status` checks active staff access and server configuration. The WebSocket URL is `/api/properties/:propertyId/staff/speech`; it validates the exact allowed Origin, signed JWT cookie, and current property membership before connecting to Deepgram. It rechecks membership every 15 seconds, closes at JWT expiry, limits connection starts to 10 per account per 15 minutes, and allows one active stream per user per API process. Recordings are capped at two minutes and 8 MiB, with bounded messages, backpressure, and dead-client cleanup. These socket connections are transient audio streams, not authentication session records. Multi-instance deployment would need a shared concurrent-stream limit.

Vite proxies WebSocket upgrades alongside `/api` HTTP requests. Production reverse proxies must also forward WebSocket Upgrade/Connection headers and the original Origin and cookie; use HTTPS/WSS. Browser microphone capture requires HTTPS or localhost. Production idle timeouts must accommodate the live stream and final transcription. Tests use a local provider fixture and synthetic audio to verify authentication, revocation, final-word flushing, provider errors, and microphone cleanup without consuming Deepgram credits.

## Owner

1. Sign in with an active owner membership. Reception access alone cannot open the live owner workspace.
2. Choose a 1–30-night reporting window and room type. The overview shows current occupancy, availability across the selected stay, scheduled booking value, reservation counts, a nightly outlook and a monthly booked-rooms chart.
3. Metric links open the underlying rooms or reservations while retaining the selected dates/type.
   The overview also includes a monthly rooms-booked bar chart. Select any month and hover, focus, or tap a day to see its booked room numbers; the room-type filter applies here too.
4. Room availability includes a nightly calendar. Select a reserved cell to find its reservation; room rows also show current occupancy separately from availability.
5. Create a guest reservation from **New reservation** (`/book`), or use the shared reservation screens for check-in, checkout and cancellation.
6. Review staff access requests, create email-bound invitations and revoke access. The API protects the last active owner. Invitations show a copyable code; no email is sent automatically.

Booking value is not collected revenue. Current occupancy is not historical occupancy. See `owner-reporting.md` for exact metric definitions. Worker metrics and delivery alerts remain deferred.

## Preview and local development

Run `npm run dev -w @hotel/reception` and `npm run dev -w @hotel/owner` from the repository root. Their normal ports are 5174 and 5175; the default guest link uses 5173 and can be overridden with `VITE_GUEST_URL` in the ignored root `.env`.

- Reception sample: `http://127.0.0.1:5174/preview/`
- Owner sample: `http://127.0.0.1:5175/preview/`
- Live access gates: the same origins at `/`

The explicit preview entry mounts a separate in-memory adapter and skips the real auth and catalog providers. It never falls back to sample data on live API errors. Fictional previews are independent per app/tab, reset on reload, and do not synchronize with PostgreSQL or each other. New reservations update preview availability and reports, and support idempotent retries. Sample invitation codes cannot grant hotel access. No tokens or passwords are stored in browser storage.

The reception's illustrative room images reuse the existing guest assets. Attribution is retained in `apps/guest/public/images/credits.txt`.

## Verification

- Automated checks cover application builds, workspace types, API JWT checks, speech proxy access controls, capture cleanup, guest stay validation, owner drilldowns, monthly booked-room previews, reception date scopes, and isolated sample bookings/transitions.
- Browser checks cover owner booking confirmation and its reservation-detail link, reception booking with email-only contact on a 390px screen, guest-capacity filtering, and clearing room selection when the stay changes. Earlier checks cover check-in/check-out, calendar drilldowns, cancellation confirmation and staff-request approval.
- Desktop and 390px mobile layouts include collapsible navigation, horizontally scrollable data tables, native modal focus containment and reduced-motion support.
- PostgreSQL integration tests exercise authenticated staff bookings in an isolated temporary schema: permissions/revocation, guest identity isolation, room and price validation, safe retries, check-in/out, report inclusion, and simultaneous customer/owner/reception requests for the last room.

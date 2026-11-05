# Pramod staff workspaces

The reception and owner apps remain independent React frontends in the Turborepo. They share the workspace shell, access gates, reservation details, housekeeping board, team controls and visual styles from `packages/ui`.

## Reception

1. Sign in with an approved receptionist or owner account. Accounts without membership can accept a receptionist invitation or request reception access. Owner accounts are provisioned privately by the setup team; the owner website only offers sign-in.
2. The front desk shows expected arrivals, departures due today or overdue, currently checked-in stays, and in-service rooms needing preparation.
3. Open an arrivals/departures/in-house view, or search reservations by guest, email, room or reference.
4. Open a reservation to review dates, guest count, assigned room and agreed value. Check-in appears only during an eligible stay; the API additionally verifies vacancy, room condition and permissions. Check-out marks the room dirty. Cancellation requires an explicit confirmation.
5. Use room readiness to search a room and mark it dirty, cleaning or clean.
6. Use availability to check a 1–30-night stay and guest capacity. Room types show live counts, nightly rates and full stay values. Availability is not an inventory hold. Existing guest checkout creates reservations; a walk-in booking endpoint is not implemented.

Reception uses the existing latest-100 reservation endpoint. If that limit is reached, the UI explicitly scopes totals to the loaded list. Owner reports do not have this list limit.

### Speech in reservation search

The microphone beside reservation search (on the front desk and Reservations pages) fills the field as you speak. Say a guest name, email, room number, or reservation reference. Stop recording to edit the text normally. Speech replaces the current query after the first recognized words; failure before recognition preserves the previous query. Search respects the selected reservation view and the latest-100 list. It does not create or change a reservation.

Set `DEEPGRAM_API_KEY` in the ignored root `.env` and run the API as well as the reception frontend. Keep the key server-only; never use a `VITE_` variable. The browser asks for microphone permission after a click and streams audio through the authenticated API WebSocket. Express connects to Deepgram with the private key, forwards interim/final text, and handles provider billing/credential failures. Deepgram billing or credits must be active. The configured Nova-3 multilingual model auto-detects speech, including English and Hindi; see the [Deepgram language documentation](https://developers.deepgram.com/docs/nova-3-language-prompting).

The microphone stops on Stop, navigation, hidden tab, permission/device failure, connection failure, or the two-minute limit. An unfinished microphone prompt can be cancelled. Final recorder bytes are sent before the server asks Deepgram to [close the stream and flush remaining words](https://developers.deepgram.com/docs/close-stream). Audio and search text are not saved by Pramod. Audio is processed by Deepgram while recording; its data handling terms apply. Sample previews disable speech and never contact Deepgram.

`GET /api/properties/:propertyId/staff/speech/status` checks active staff access and server configuration. The WebSocket URL is `/api/properties/:propertyId/staff/speech`; it validates the exact allowed Origin, signed JWT cookie, and current property membership before connecting to Deepgram. It rechecks membership every 15 seconds, closes at JWT expiry, limits connection starts to 10 per account per 15 minutes, and allows one active stream per user per API process. Recordings are capped at two minutes and 8 MiB, with bounded messages, backpressure, and dead-client cleanup. These socket connections are transient audio streams, not authentication session records. Multi-instance deployment would need a shared concurrent-stream limit.

Vite proxies WebSocket upgrades alongside `/api` HTTP requests. Production reverse proxies must also forward WebSocket Upgrade/Connection headers and the original Origin and cookie; use HTTPS/WSS. Browser microphone capture requires HTTPS or localhost. Production idle timeouts must accommodate the live stream and final transcription. Tests use a local provider fixture and synthetic audio to verify authentication, revocation, final-word flushing, provider errors, and microphone cleanup without consuming Deepgram credits.

## Owner

1. Sign in with an active owner membership. Reception access alone cannot open the live owner workspace.
2. Choose a 1–30-night reporting window and room type. The overview shows current occupancy, availability across the selected stay, scheduled booking value, reservation counts, a nightly outlook and current room readiness.
3. Metric links open the underlying rooms or reservations while retaining the selected dates/type.
4. Room availability includes a nightly calendar. Select a reserved cell to find its reservation; room rows also show current occupancy and housekeeping separately.
5. Use the shared reservation and readiness screens for operational tasks.
6. Review staff access requests, create email-bound invitations and revoke access. The API protects the last active owner. Invitations show a copyable code; no email is sent automatically.

Booking value is not collected revenue. Current occupancy is not historical occupancy. See `owner-reporting.md` for exact metric definitions. Worker metrics and delivery alerts remain deferred.

## Preview and local development

Run `npm run dev -w @hotel/reception` and `npm run dev -w @hotel/owner` from the repository root. Their normal ports are 5174 and 5175; the default guest link uses 5173 and can be overridden with `VITE_GUEST_URL` in the ignored root `.env`.

- Reception sample: `http://127.0.0.1:5174/preview/`
- Owner sample: `http://127.0.0.1:5175/preview/`
- Live access gates: the same origins at `/`

The explicit preview entry mounts a separate in-memory adapter and skips the real auth and catalog providers. It never falls back to sample data on live API errors. Fictional previews are independent per app/tab, reset on reload, and do not synchronize with PostgreSQL or each other. Sample invitation codes cannot grant hotel access. No tokens or passwords are stored in browser storage.

The reception's illustrative room images reuse the existing guest assets. Attribution is retained in `apps/guest/public/images/credits.txt`.

## Verification

- All four application builds, workspace type checks, and the full 41-test suite pass, including API JWT checks, speech proxy access controls, capture cleanup, guest stay validation, owner drilldowns, reception date scopes and isolated sample transitions.
- Browser checks cover sample check-in/check-out, dirty-to-clean housekeeping, capacity filtering, calendar-to-reservation drilldowns, cancellation confirmation and staff-request approval.
- Desktop and 390px mobile layouts include collapsible navigation, horizontally scrollable data tables, native modal focus containment and reduced-motion support.
- Real authenticated writes were not exercised in this frontend pass: the API and PostgreSQL were not running. Existing API contracts and authorization are retained.

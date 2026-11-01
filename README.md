# Pramod hotel

A hotel application for Pramod, initially serving a single property with room to expand. npm workspaces and Turborepo coordinate React + TypeScript + Vite frontends, an Express + TypeScript API, and PostgreSQL accessed through `pg`.

## Requirements

- Node.js 22.22+ (tested with Node.js 24)
- npm
- Docker with Docker Compose, or an existing PostgreSQL database

## Quick start

Run these commands from the repository root. Start Docker Desktop first.

```sh
npm install
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

- Guest website: http://127.0.0.1:5173
- Reception workspace: http://127.0.0.1:5174
- Owner dashboard: http://127.0.0.1:5175
- API liveness: http://localhost:4000/api/health
- Database readiness: http://localhost:4000/api/ready
- Demo catalog: http://localhost:4000/api/properties/demo-hotel

`setup` creates the ignored root `.env` from `.env.example` and generates a random JWT signing secret if one is missing. It preserves existing settings and signing keys. The database starts in Docker, while all three React apps and the API run directly on your machine with automatic reload. Each frontend proxies `/api` to the same Express service. Use the same hostname (`127.0.0.1` or `localhost`) across all three local apps so their host-only authentication cookie is shared.

The optional demo seed creates one placeholder hotel, three room types, and three rooms. It is safe to run again without duplicating or overwriting these records. No accounts or passwords are seeded. The frontend uses this catalog and the Pramod branding configured in `apps/guest/src/config/hotel.ts`. Without the seed, room sections show a retry message.

## Frontend experience

| Route | Implemented behavior |
| --- | --- |
| `/` | Customer-facing homepage, hotel introduction, room collection, and stay search |
| `/rooms` | Date-based inventory, guest-capacity filtering, server-price sorting, and validated date selection |
| `/rooms/:roomId` | Room details, illustrative amenities, and stay review entry |
| `/stay` | Live inventory and server quote, authenticated reservation confirmation, optional local stay plan |
| `/gallery` | Photo categories and keyboard-accessible image viewer |
| `/account` | Customer registration, sign-in/out, short-lived JWT authentication, own reservations and cancellation |
| `/staff` | Links to the separate reception and owner workspaces |

The table above describes the guest app. Reception has `/` for reservations and `/readiness` for housekeeping. It supports account registration/sign-in, invitation acceptance, and receptionist access requests when the account does not yet have hotel access.

The owner app requires an active owner membership and provides:

| Owner route | Behavior |
| --- | --- |
| `/` | Live occupancy, available rooms, booking value, reservation totals, today's arrivals/departures, nightly outlook, and room readiness |
| `/availability` | Date and room-type filters, room search/status filter, per-room occupancy/housekeeping and reservation details |
| `/reservations` | Search, status filters, dashboard drilldowns, and cancellation/check-in/check-out |
| `/readiness` | Update housekeeping using the same API as reception |
| `/team` | Approve requests, invite receptionists/owners, and remove access |

Metric cards open their underlying rooms or reservations. Availability filters use inclusive arrival and exclusive departure dates, with a 1–30 night window. Current occupancy is separate from future reserved inventory. Booking value excludes cancellations, counts only nights in the selected window, and keeps currencies separate; it does not represent collected payments. See [the reporting contract](docs/owner-reporting.md) for exact definitions. Worker metrics and alerts are deferred.

The customer experience is public. Account creation creates a customer account first; hotel staff permissions are added through an owner invitation or approval. There is no public role selector that grants staff access.

Search checks PostgreSQL inventory for the requested dates. Reservation confirmation recalculates the price and allocates a physical room in a transaction. The demo rates are stored in `room_types.nightly_rate_minor`, in paise for INR. The booking stores its agreed rate, currency, and room total; a changed price requires the customer to refresh and review it. No taxes, payment processing, or financial settlement is implemented.

Saved stay plans remain browser-local and do not hold inventory. Confirmed reservations are stored in PostgreSQL and appear under the customer's account. The frontend sends a booking idempotency key and retains it in session storage until the request succeeds, so retrying an interrupted request returns the original reservation. Account credentials and JWTs are never stored in local storage.

The layout includes responsive navigation, keyboard focus indicators, loading/error/empty states, and a gallery dialog with Escape/arrow-key support. The current photos and amenities are illustrative; replace them with the hotel's confirmed content before launch. Image sources and licensing are recorded in `apps/guest/public/images/credits.txt`.

The guest homepage follows the architectural direction in the supplied Pinterest reference: a live wordmark behind an original transparent hero image, a floating navigation pill, layered room cards, and a dark room collection with image previews on hover or keyboard focus. `apps/guest/src/experience.css` holds the visual treatment; the existing booking layouts remain in `styles.css`. `ArchitecturalHero` reveals the building first, then raises the Antonio lettering into place. Native CSS sticky positioning keeps the lettering stationary while the building scrolls over it, without per-frame JavaScript transforms. The full-width navigation stays transparent on all guest routes; its foreground switches contrast over dark homepage sections. `Reveal` animates sections once when they enter the viewport. Motion honors `prefers-reduced-motion`, including changes while the page is open. Navigation between routes resets the scroll position immediately. See [design QA](design-qa.md) for screenshots, responsive checks, and the reference comparison.

## Project structure

```text
apps/guest/
  src/
    App.tsx                  Application routes
    components/              Shared navigation, search, and room components
    pages/                   Customer, gallery, account, and staff screens
    context/                 API-backed catalog state
    config/hotel.ts          Pramod branding and illustrative room presentation
    lib/api.ts               Typed API client
    lib/stay.ts              Calendar-date validation and saved-plan helpers
    styles.css               Responsive styles
  vite.config.ts             Frontend server and API proxy
apps/api/
  src/
    app.ts                   Express routes and middleware
    server.ts                Server lifecycle
    config/env.ts            Validated environment configuration
    db/                      Connection pool, migrations, seed runner
    modules/catalog/         Property and room-type queries
    modules/auth/            Registration, password hashing, JWT authentication, rate limits
    modules/staff/           Hotel permissions, requests, invitations, audit trail
    modules/bookings/        Availability, room allocation, pricing, stay transitions
    modules/owner/           Owner-only metrics and inventory reports
  migrations/                Versioned SQL schema
  test/                      API behavior and failure-path tests
apps/reception/              Independent reception React app (5174)
apps/owner/                  Independent owner React app (5175)
packages/api-client/         Typed fetch, shared account/catalog providers, frontend URLs
packages/contracts/          Browser-safe API types (no server code or credentials)
packages/ui/                 Shared access gates, workspace shell, reservation/team/room components
packages/config/             Shared React TypeScript and Vite configuration
turbo.json                   Task graph, cache outputs, and environment inputs
scripts/setup.mjs            Safe local environment setup
compose.yaml                 PostgreSQL service and persistent volume
.env.example                 Local configuration template
```

## Commands

Turborepo runs development tasks in parallel and caches builds, type checks, and unit tests. Database migrations, seeds, owner provisioning, and integration tests run directly and are never cached. Use `npm run dev -- --filter=@hotel/guest --filter=@hotel/api` to start only the guest site and API. Each app remains independently buildable through its npm workspace.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run guest, reception, owner, and API together |
| `npm run typecheck` | Check frontend, backend, and test TypeScript |
| `npm test` | Run API, stay-date, and owner drilldown tests; no database needed |
| `npm run test:integration` | Exercise the real API and PostgreSQL in an isolated temporary schema |
| `npm run owner:bootstrap -- demo-hotel owner@example.com` | Assign the first owner to an already registered account |
| `npm run build` | Compile the API and build all three frontends |
| `npm run db:up` | Start PostgreSQL and wait for it to become healthy |
| `npm run db:down` | Stop/remove the container while preserving database data |
| `npm run db:logs` | Follow database logs |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Add the optional local demo data |
| `npm run start -w @hotel/api` | Run the compiled API after building |
| `npm run preview -w @hotel/guest` | Preview the built frontend on port 4173 |
| `npm run preview -w @hotel/reception` | Preview reception on port 4174 |
| `npm run preview -w @hotel/owner` | Preview owner on port 4175 |

Each app builds into its own `apps/<name>/dist`. Shared frontend packages expose TypeScript source to Vite, so there are no extra library build/watch processes. To inspect a production build locally, run the compiled API and the frontend previews in separate terminals. Set the API's three allowed origins to the corresponding preview ports (4173/4174/4175), and set `VITE_*_URL` to those preview URLs at build time if checking cross-app links. Vite preview is a local build check, not a production hosting server.

## Configuration

The root `.env` is server-side configuration. Never put database credentials in variables prefixed with `VITE_`, because those variables can be bundled into browser code.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local Docker database initialization |
| `POSTGRES_PORT` | Host port mapped to PostgreSQL; defaults to 5432 |
| `DATABASE_URL` | PostgreSQL connection URL used by Express and migration scripts |
| `API_PORT` | Backend port and Vite proxy target; defaults to 4000 |
| `FRONTEND_ORIGIN` | Exact guest origin allowed for API reads/writes; default localhost:5173 |
| `RECEPTION_ORIGIN`, `OWNER_ORIGIN` | Exact additional trusted origins; default localhost:5174/5175 in development, no implicit production defaults |
| `DEV_TUNNEL_ORIGIN` | Optional exact HTTP(S) tunnel origin allowed alongside local origins, only when `NODE_ENV=development` |
| `VITE_GUEST_URL`, `VITE_RECEPTION_URL`, `VITE_OWNER_URL` | Public cross-app links, configured at build time; local ports are the development fallback |
| `VITE_PROPERTY_SLUG` | Property catalog used by all three apps; defaults to `demo-hotel` |
| `NODE_ENV` | Runtime environment; demo seeding is disabled in production |

If using an existing database, set `DATABASE_URL` and skip `db:up`. If changing Docker database credentials or the port, update `DATABASE_URL` to match. PostgreSQL initialization variables apply only when creating a fresh volume; changing them does not change credentials in an existing database.

The application and Docker database bind to loopback for local development. Data persists in the Compose volume across restarts. `db:down` does not erase it. The local demo credentials are not suitable for a deployed environment.

For a guest preview through ngrok, run `ngrok http http://127.0.0.1:<guest-port>`. Restart the API with `DEV_TUNNEL_ORIGIN` set to the issued HTTPS URL, and restart the guest frontend with `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` set to that URL's hostname only. Keep the normal local origins configured too. These settings allow only the selected tunnel; do not disable Vite's host check or rewrite browser Origin headers. Stop ngrok when the preview is finished.

## Database foundation

The initial migration creates `properties`, `users`, `staff_memberships`, `room_types`, and `rooms`. Each room belongs to a property, and a composite foreign key prevents assigning a room type from another property.

Owner and receptionist roles are property-specific staff memberships. Customers see and cancel only their own reservations. Owners approve receptionist requests, create email-bound invitations, and revoke access. Receptionists can view hotel reservations, check guests in/out, and update housekeeping status. Every protected operation checks the current database membership; the frontend role is never authoritative. The last active owner cannot be removed through the API.

The account migration adds password hashes, shared rate limits, staff requests/invitations, audit events, bookings, physical room allocations, and a notification outbox. Migration `004_stateless_auth.sql` removes the obsolete opaque-session table introduced by migration 002; existing accounts and hotel data remain intact. Composite foreign keys keep room types, rooms, and bookings within the same hotel. A PostgreSQL GiST exclusion constraint prevents overlapping active allocations even under concurrent requests. Stays use `[check_in, check_out)` date ranges in the property's timezone, so checkout-day arrivals are allowed. The API currently supports one room per reservation, up to six guests subject to room capacity, and one to thirty nights. Room types without configured rates cannot be reserved.

Cancellation releases the allocation in the same transaction. Check-in requires an eligible date, a clean room in service, and no previous guest still checked in. Check-out marks the room dirty. Permanent out-of-service rooms are excluded from availability; scheduled maintenance blocks and room moves are future work.

Add future migrations as numbered SQL files under `apps/api/migrations`. The runner serializes migrations, applies them transactionally, and records checksums. Never edit an already applied migration; add another file instead. The database migration account needs permission to install `btree_gist`.

## First owner and staff access

1. Start the app and create the intended owner's account at `/account?mode=register`.
2. Verify the intended person's identity/email, then run `npm run owner:bootstrap -- demo-hotel their-email@example.com` from the repository root.
3. Open http://127.0.0.1:5175 and sign in (or refresh access if already signed in). The owner dashboard's Hotel team page can approve receptionist requests or create invitations for receptionists/additional owners.

Bootstrap refuses to run once an active owner exists. Invitations expire after seven days, are bound to the invited account email, and can be accepted only once while the issuing owner retains access. The raw code is shown only when created; share it privately with the intended person. No email is sent automatically. There are no seeded accounts, default passwords, or public owner-registration endpoints.

## Authentication and deployment boundary

Passwords use salted Node.js scrypt (`N=131072, r=8, p=1`) and must contain 15–128 characters at registration. After password verification, the API issues an HS256 JWT using [jose](https://github.com/panva/jose). Each request verifies the signature, allowed algorithm, token type, issuer, audience, required identity claims, issue time, and expiry before trusting the user ID. Authentication does not read or write a session table or look up the user. Staff permissions still come from the current PostgreSQL membership on each protected operation; permissions are not embedded in JWTs.

JWTs expire after 15 minutes by default (`JWT_TTL_SECONDS=900`, configurable from 60 to 3600 seconds). There are no refresh tokens, session records, or revocation lists. The shared frontend checks authentication at expiry, on focus, and after a protected request returns 401; users sign in again after expiry. Logout clears the browser cookie, but a copied JWT remains valid until its expiry. Signing in again does not invalidate earlier JWTs. Identity details in a JWT remain a snapshot until the next login; deleting an account or changing its password would not invalidate an existing JWT. Individual immediate token revocation would require server-side state. Rotating the signing key invalidates all outstanding tokens.

Run `npm run setup` when upgrading to generate the missing local `JWT_SECRET`, then `npm run db:migrate` and restart the API. Existing opaque cookies are no longer accepted, so existing users must sign in again. Production must supply its own cryptographically random 32-byte secret encoded as 64 hexadecimal characters. There is no fallback key; missing or malformed keys prevent startup. All API instances must use the same `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, and lifetime configuration. Keep the secret in the deployment secret store, never in source control or a `VITE_*` variable.

Cookies are HttpOnly, host-only, and SameSite=Lax; production uses the Secure `__Host-pramod_access` cookie, and development uses `pramod_access`. The cookie expires with its JWT, and token values are never returned in JSON or stored in browser storage. `/auth/me` returns an `expiresAt` timestamp for the UI. All API responses use `Cache-Control: no-store`. Authenticated writes require JSON and an exact allowed `Origin`, including login and registration. Rate counters are shared in PostgreSQL, so adding API instances does not bypass the limits.

Set `FRONTEND_ORIGIN`, `RECEPTION_ORIGIN`, and `OWNER_ORIGIN` to the exact HTTPS origins for production. Each frontend must serve its SPA routes and reverse-proxy `/api` to Express while preserving the browser's Origin header. Configure the three public `VITE_*_URL` values when building. Development additionally allows localhost/127.0.0.1 equivalents at the configured ports. Cookies remain host-only: accounts and permissions are shared, but different production hosts require separate sign-ins. Cross-host SSO is not implemented, and no tokens are passed in URLs or browser storage.

The application does not trust forwarded client IP headers by default; before deploying behind a proxy, configure Express trust-proxy for that specific topology. Otherwise IP-based auth throttles apply to the proxy address. Delete expired rate-limit records through an operational maintenance job as usage grows.

This is a local development implementation. Email verification, password recovery, MFA, payments/taxes, production backups/monitoring, pagination beyond the latest 100 reservations, and a notification delivery provider are not implemented. Replace demo prices and hotel content before launch. Never use the local database credentials in deployment.

## Booking events and future scaling

Booking confirmation/cancellation writes an event into `notification_outbox` in the same transaction as the reservation change. Events remain pending; there is no email/SMS worker running and no external messages are sent. A later worker should claim pending events, use provider idempotency/deduplication, retry transient failures, and record delivery. Event recording is durable, but recording an event is not notification delivery.

The initial deployment remains one modular Express service plus PostgreSQL. Additional API instances verify JWTs independently using the same signing configuration behind an HTTPS load balancer; database permissions and rate limits remain shared. Add Redis for measured cache/rate-limit needs later; it must not decide reservation availability. Monitoring and operational alerts belong alongside API/database/worker activity, independently of guest notification jobs.

## Integration verification

`npm run test:integration` requires the local database and creates a randomly named `hotel_test_*` schema. It applies all migrations, uses a temporary signing key and synthetic hotel/account fixtures, runs real HTTP requests, and drops that schema afterward. It refuses a production configuration and does not alter existing hotel/account rows. Coverage includes role escalation attempts, invitation replay/expiry, removed staff with still-valid JWTs, cross-hotel access, JWT expiry/tampering, cookie logout and replay semantics, forged prices, simultaneous reservations, database overlap rejection, cancellation, checkout-day reuse, and housekeeping transitions. API unit tests additionally cover claim validation, algorithm restrictions, production cookies, and authentication without a database.

## API behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Process liveness; stays healthy when PostgreSQL is offline |
| `GET /api/ready` | Runs a real database query; returns 503 when unavailable |
| `GET /api/properties/:slug` | Public property details and room types; 404 for unknown slugs |
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | Account and JWT authentication lifecycle |
| `GET /api/properties/:propertyId/availability` | Public date/capacity availability and current room totals |
| `POST /api/properties/:propertyId/bookings` | Customer reservation with authoritative price and idempotency key |
| `GET /api/bookings`; `POST /api/bookings/:id/cancel` | Own reservations and cancellation |
| `GET /api/properties/:propertyId/bookings` | Hotel reservations, restricted to current staff |
| `POST /api/properties/:propertyId/bookings/:id/:action` | Staff `check-in`, `check-out`, and `cancel` |
| `/api/properties/:propertyId/staff/*` | Access, requests/review, invitations/accept, team/revoke, housekeeping |
| `GET /api/properties/:propertyId/owner/dashboard` | Owner-only report with optional `from`, `to`, and `roomTypeId` filters |

The catalog endpoint exposes public hotel information only. Database queries use parameters. Responses do not expose internal errors or credentials. Readiness checks connectivity; the catalog additionally verifies the schema and seeded data path.

## Troubleshooting

- Docker connection error: start Docker Desktop, then retry `npm run db:up`.
- Port 5432 already in use: change `POSTGRES_PORT` and `DATABASE_URL` together.
- Frontend cannot load the catalog: check `/api/ready`, then run migrations and the optional seed.
- API port conflict: change `API_PORT` in `.env` and restart the development servers.
- Changing a frontend port: update its Vite port, corresponding API allowed origin, and public frontend URL together.

## Reference documentation

- [Turborepo migration guide](https://turborepo.dev/docs/getting-started/add-to-existing-repository)
- [Turborepo environment and caching](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)
- [Vite](https://vite.dev/guide/)
- [Express](https://expressjs.com/en/starter/installing/)
- [node-postgres](https://node-postgres.com/features/connecting)
- [PostgreSQL Docker image](https://hub.docker.com/_/postgres)
- [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/18/rangetypes.html#RANGETYPES-CONSTRAINT)
- [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP CSRF origin validation](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

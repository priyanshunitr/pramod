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

- Frontend: http://localhost:5173
- API liveness: http://localhost:4000/api/health
- Database readiness: http://localhost:4000/api/ready
- Demo catalog: http://localhost:4000/api/properties/demo-hotel

`setup` creates the ignored root `.env` from `.env.example` without overwriting an existing file. The database starts in Docker, while the frontend and backend run directly on your machine with automatic reload. The frontend proxies `/api` requests to Express.

The optional demo seed creates one placeholder hotel, three room types, and three rooms. It is safe to run again without duplicating or overwriting these records. No accounts or passwords are seeded. The frontend uses this catalog and the Pramod branding configured in `apps/guest/src/config/hotel.ts`. Without the seed, room sections show a retry message.

## Frontend experience

| Route | Implemented behavior |
| --- | --- |
| `/` | Customer-facing homepage, hotel introduction, room collection, and stay search |
| `/rooms` | Date-based inventory, guest-capacity filtering, server-price sorting, and validated date selection |
| `/rooms/:roomId` | Room details, illustrative amenities, and stay review entry |
| `/stay` | Live inventory and server quote, authenticated reservation confirmation, optional local stay plan |
| `/gallery` | Photo categories and keyboard-accessible image viewer |
| `/account` | Customer registration, sign-in/out, persistent sessions, own reservations and cancellation |
| `/staff` | Access requests/invitations; reception workspace; owner team management; room readiness |

The customer experience is public. Account creation is designed to create a customer account first; hotel staff permissions will be added through an owner invitation or approval. There is no public role selector that grants staff access.

Search checks PostgreSQL inventory for the requested dates. Reservation confirmation recalculates the price and allocates a physical room in a transaction. The demo rates are stored in `room_types.nightly_rate_minor`, in paise for INR. The booking stores its agreed rate, currency, and room total; a changed price requires the customer to refresh and review it. No taxes, payment processing, or financial settlement is implemented.

Saved stay plans remain browser-local and do not hold inventory. Confirmed reservations are stored in PostgreSQL and appear under the customer's account. The frontend sends a booking idempotency key and retains it in session storage until the request succeeds, so retrying an interrupted request returns the original reservation. Account credentials and session tokens are never stored in local storage.

The layout includes responsive navigation, keyboard focus indicators, loading/error/empty states, and a gallery dialog with Escape/arrow-key support. The current photos and amenities are illustrative; replace them with the hotel's confirmed content before launch. Image sources and licensing are recorded in `apps/guest/public/images/credits.txt`.

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
    modules/auth/            Registration, password hashing, sessions, rate limits
    modules/staff/           Hotel permissions, requests, invitations, audit trail
    modules/bookings/        Availability, room allocation, pricing, stay transitions
  migrations/                Versioned SQL schema
  test/                      API behavior and failure-path tests
scripts/setup.mjs            Safe local environment setup
compose.yaml                 PostgreSQL service and persistent volume
.env.example                 Local configuration template
```

## Commands

Turborepo runs development tasks in parallel and caches builds, type checks, and unit tests. Database migrations, seeds, owner provisioning, and integration tests run directly and are never cached. Use `npm run dev -- --filter=@hotel/guest --filter=@hotel/api` to start only the guest site and API. Each app remains independently buildable through its npm workspace.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the frontend and backend together |
| `npm run typecheck` | Check frontend, backend, and test TypeScript |
| `npm test` | Run API and stay-date validation tests; no database needed |
| `npm run test:integration` | Exercise the real API and PostgreSQL in an isolated temporary schema |
| `npm run owner:bootstrap -- demo-hotel owner@example.com` | Assign the first owner to an already registered account |
| `npm run build` | Compile the backend and build the frontend |
| `npm run db:up` | Start PostgreSQL and wait for it to become healthy |
| `npm run db:down` | Stop/remove the container while preserving database data |
| `npm run db:logs` | Follow database logs |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Add the optional local demo data |
| `npm run start -w @hotel/api` | Run the compiled API after building |
| `npm run preview -w @hotel/guest` | Preview the built frontend on port 4173 |

The frontend build is written to `apps/guest/dist`; the backend build is written to `apps/api/dist`. To inspect a production build locally, run the compiled API and frontend preview in separate terminals. Vite preview is a local build check, not a production hosting server.

## Configuration

The root `.env` is server-side configuration. Never put database credentials in variables prefixed with `VITE_`, because those variables can be bundled into browser code.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Local Docker database initialization |
| `POSTGRES_PORT` | Host port mapped to PostgreSQL; defaults to 5432 |
| `DATABASE_URL` | PostgreSQL connection URL used by Express and migration scripts |
| `API_PORT` | Backend port and Vite proxy target; defaults to 4000 |
| `FRONTEND_ORIGIN` | Allowed browser origin for direct API requests |
| `NODE_ENV` | Runtime environment; demo seeding is disabled in production |

If using an existing database, set `DATABASE_URL` and skip `db:up`. If changing Docker database credentials or the port, update `DATABASE_URL` to match. PostgreSQL initialization variables apply only when creating a fresh volume; changing them does not change credentials in an existing database.

The application and Docker database bind to loopback for local development. Data persists in the Compose volume across restarts. `db:down` does not erase it. The local demo credentials are not suitable for a deployed environment.

## Database foundation

The initial migration creates `properties`, `users`, `staff_memberships`, `room_types`, and `rooms`. Each room belongs to a property, and a composite foreign key prevents assigning a room type from another property.

Owner and receptionist roles are property-specific staff memberships. Customers see and cancel only their own reservations. Owners approve receptionist requests, create email-bound invitations, and revoke access. Receptionists can view hotel reservations, check guests in/out, and update housekeeping status. Every protected operation checks the current database membership; the frontend role is never authoritative. The last active owner cannot be removed through the API.

The account migration adds password hashes, hashed opaque sessions, shared rate limits, staff requests/invitations, audit events, bookings, physical room allocations, and a notification outbox. Composite foreign keys keep room types, rooms, and bookings within the same hotel. A PostgreSQL GiST exclusion constraint prevents overlapping active allocations even under concurrent requests. Stays use `[check_in, check_out)` date ranges in the property's timezone, so checkout-day arrivals are allowed. The API currently supports one room per reservation, up to six guests subject to room capacity, and one to thirty nights. Room types without configured rates cannot be reserved.

Cancellation releases the allocation in the same transaction. Check-in requires an eligible date, a clean room in service, and no previous guest still checked in. Check-out marks the room dirty. Permanent out-of-service rooms are excluded from availability; scheduled maintenance blocks and room moves are future work.

Add future migrations as numbered SQL files under `apps/api/migrations`. The runner serializes migrations, applies them transactionally, and records checksums. Never edit an already applied migration; add another file instead. The database migration account needs permission to install `btree_gist`.

## First owner and staff access

1. Start the app and create the intended owner's account at `/account?mode=register`.
2. Verify the intended person's identity/email, then run `npm run owner:bootstrap -- demo-hotel their-email@example.com` from the repository root.
3. Refresh `/staff`. The owner workspace can approve receptionist requests or create invitations for receptionists/additional owners.

Bootstrap refuses to run once an active owner exists. Invitations expire after seven days, are bound to the invited account email, and can be accepted only once while the issuing owner retains access. The raw code is shown only when created; share it privately with the intended person. No email is sent automatically. There are no seeded accounts, default passwords, or public owner-registration endpoints.

## Authentication and deployment boundary

Passwords use salted Node.js scrypt (`N=131072, r=8, p=1`) and must contain 15–128 characters at registration. Sessions use random 256-bit tokens, store only their SHA-256 hashes, expire after seven days, rotate on sign-in, and are revoked on sign-out. Cookies are HttpOnly and SameSite=Lax; production uses a Secure `__Host-` cookie. All API responses use `Cache-Control: no-store`. Authenticated writes require JSON and an exact allowed `Origin`, including login and registration. Rate counters are shared in PostgreSQL, so adding API instances does not bypass the limits.

Set `FRONTEND_ORIGIN` to the exact HTTPS frontend origin for production and serve `/api` behind the same origin. Development additionally allows the localhost/127.0.0.1 equivalent at the configured port. The application does not trust forwarded client IP headers by default; before deploying behind a proxy, configure Express trust-proxy for that specific topology. Otherwise IP-based auth throttles apply to the proxy address. Delete expired session/rate-limit records through an operational maintenance job as usage grows.

This is a local development implementation. Email verification, password recovery, MFA, payments/taxes, production backups/monitoring, pagination beyond the latest 100 reservations, and a notification delivery provider are not implemented. Replace demo prices and hotel content before launch. Never use the local database credentials in deployment.

## Booking events and future scaling

Booking confirmation/cancellation writes an event into `notification_outbox` in the same transaction as the reservation change. Events remain pending; there is no email/SMS worker running and no external messages are sent. A later worker should claim pending events, use provider idempotency/deduplication, retry transient failures, and record delivery. Event recording is durable, but recording an event is not notification delivery.

The initial deployment remains one modular Express service plus PostgreSQL. Additional API instances can share database sessions and rate limits behind an HTTPS load balancer. Add Redis for measured cache/rate-limit needs later; it must not decide reservation availability. Monitoring and operational alerts belong alongside API/database/worker activity, independently of guest notification jobs.

## Integration verification

`npm run test:integration` requires the local database and creates a randomly named `hotel_test_*` schema. It applies all migrations, creates synthetic hotel/account fixtures, runs real HTTP requests, and drops that schema afterward. It refuses a production configuration and does not alter existing hotel/account rows. Coverage includes role escalation attempts, invitation replay/expiry, removed staff, cross-hotel access, session expiry/logout, forged prices, simultaneous reservations, database overlap rejection, cancellation, checkout-day reuse, and housekeeping transitions.

## API behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Process liveness; stays healthy when PostgreSQL is offline |
| `GET /api/ready` | Runs a real database query; returns 503 when unavailable |
| `GET /api/properties/:slug` | Public property details and room types; 404 for unknown slugs |
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | Account and session lifecycle |
| `GET /api/properties/:propertyId/availability` | Public date/capacity availability and current room totals |
| `POST /api/properties/:propertyId/bookings` | Customer reservation with authoritative price and idempotency key |
| `GET /api/bookings`; `POST /api/bookings/:id/cancel` | Own reservations and cancellation |
| `GET /api/properties/:propertyId/bookings` | Hotel reservations, restricted to current staff |
| `POST /api/properties/:propertyId/bookings/:id/:action` | Staff `check-in`, `check-out`, and `cancel` |
| `/api/properties/:propertyId/staff/*` | Access, requests/review, invitations/accept, team/revoke, housekeeping |

The catalog endpoint exposes public hotel information only. Database queries use parameters. Responses do not expose internal errors or credentials. Readiness checks connectivity; the catalog additionally verifies the schema and seeded data path.

## Troubleshooting

- Docker connection error: start Docker Desktop, then retry `npm run db:up`.
- Port 5432 already in use: change `POSTGRES_PORT` and `DATABASE_URL` together.
- Frontend cannot load the catalog: check `/api/ready`, then run migrations and the optional seed.
- API port conflict: change `API_PORT` in `.env` and restart both development servers.
- Changing frontend port: update the Vite server port and `FRONTEND_ORIGIN` together.

## Reference documentation

- [Vite](https://vite.dev/guide/)
- [Express](https://expressjs.com/en/starter/installing/)
- [node-postgres](https://node-postgres.com/features/connecting)
- [PostgreSQL Docker image](https://hub.docker.com/_/postgres)
- [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/18/rangetypes.html#RANGETYPES-CONSTRAINT)
- [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP CSRF origin validation](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

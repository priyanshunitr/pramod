# Hotel workspace

A local starter for a single hotel, with room to add more properties. The stack is React + TypeScript + Vite on the frontend, Express + TypeScript on the backend, and PostgreSQL accessed through `pg`.

## Requirements

- Node.js 22.12+ (tested with Node.js 24)
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

The optional demo seed creates one placeholder hotel, three room types, and three rooms. It is safe to run again without duplicating or overwriting these records. No accounts or passwords are seeded. If you skip the seed, the starter page shows an empty-setup message.

## Project structure

```text
frontend/
  src/
    App.tsx                  Starter interface and room catalog
    lib/api.ts               Typed API client
    styles.css               Responsive styles
  vite.config.ts             Frontend server and API proxy
backend/
  src/
    app.ts                   Express routes and middleware
    server.ts                Server lifecycle
    config/env.ts            Validated environment configuration
    db/                      Connection pool, migrations, seed runner
    modules/catalog/         Property and room-type queries
  migrations/                Versioned SQL schema
  test/                      API behavior and failure-path tests
scripts/setup.mjs            Safe local environment setup
compose.yaml                 PostgreSQL service and persistent volume
.env.example                 Local configuration template
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the frontend and backend together |
| `npm run typecheck` | Check frontend, backend, and test TypeScript |
| `npm test` | Run API tests; does not require a running database |
| `npm run build` | Compile the backend and build the frontend |
| `npm run db:up` | Start PostgreSQL and wait for it to become healthy |
| `npm run db:down` | Stop/remove the container while preserving database data |
| `npm run db:logs` | Follow database logs |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:seed` | Add the optional local demo data |
| `npm run start -w backend` | Run the compiled API after building |
| `npm run preview -w frontend` | Preview the built frontend on port 4173 |

The frontend build is written to `frontend/dist`; the backend build is written to `backend/dist`. To inspect a production build locally, run the compiled API and frontend preview in separate terminals. Vite preview is a local build check, not a production hosting server.

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

Owner and receptionist roles are property-specific staff memberships. Customers are regular users; their eventual access will be limited to their own bookings. Authentication, invitations, permission enforcement, bookings, availability allocation, pricing, and payments are not implemented yet. The role cards in the frontend are previews, not working portals.

Add future migrations as numbered SQL files under `backend/migrations`, such as `002_bookings.sql`. The runner serializes migrations, applies them transactionally, and records checksums. Never edit an already applied migration; add another file instead.

## API behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Process liveness; stays healthy when PostgreSQL is offline |
| `GET /api/ready` | Runs a real database query; returns 503 when unavailable |
| `GET /api/properties/:slug` | Public property details and room types; 404 for unknown slugs |

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

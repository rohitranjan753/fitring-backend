# FitRing Companion — Backend

Express + TypeORM + PostgreSQL API for the ERBrains wearable health & shopping take-home. Implements all 12 endpoints from the assignment brief, with idempotent health-reading ingestion and atomic order creation as the two pieces of business logic that actually get tested (see `npm test`).

Built on plain Express rather than a framework like NestJS so the request flow stays directly traceable — no decorators, no dependency-injection container, no module wiring to learn before you can follow a request from route to database.

## Status

Builds, lints, and tests clean (`npm run build`, `npm run lint`, `npm test`, `npm run test:e2e`) — **and verified live**, not just compiled: run against a real local PostgreSQL with login, device registration, idempotent health ingestion (a retried batch produces zero duplicate rows), summary aggregation, cart, and a full order-placement flow all confirmed working end to end.

## Setup

```bash
npm install
cp .env.example .env   # edit DATABASE_URL if not using local Postgres
npm run start:dev
```

Needs a running PostgreSQL:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb fitring
```

With `DB_SYNCHRONIZE=true` (the `.env.example` default), the schema in [`src/database/schema.sql`](src/database/schema.sql) is created automatically from the TypeORM entities on boot — no manual migration step needed for local/dev use. Turn it off for anything beyond development.

Seed a demo user and a small product catalog (there's no signup endpoint — see [Auth](#auth) below):

```bash
npm run seed
```

## Architecture

```
HTTP → Router (Express) → requireAuth middleware (if needed) → logic function → TypeORM → PostgreSQL
```

Each of the six resource areas — `auth`, `devices`, `health`, `products`, `cart`, `orders` — is a folder with two files:

```
<resource>/
  <resource>.routes.ts   # HTTP wiring: parses the request, calls logic, sends the response
  <resource>.logic.ts    # the actual behavior — plain functions, unit tested directly
```

A route handler is typically three lines: validate the input with a `zod` schema, call a logic function, send the result. All the logic functions take a TypeORM `DataSource` as their first argument rather than having it injected — there's no container resolving anything; you can `Cmd+click` straight from a route into the function it calls into the query it runs.

`assertDeviceOwnership()` (in `devices/devices.logic.ts`) is the single choke point every device-scoped route calls through — a user can never read or write another user's device data.

Errors are just thrown `HttpError` subclasses (`NotFoundError`, `ForbiddenError`, etc. — see `src/errors/http-error.ts`) or `zod` validation errors; one error-handling middleware at the bottom of `app.ts` turns whichever was thrown into the right HTTP response. No decorators, no exception filters — a route function throws, `errorHandler` catches.

## Auth

`POST /auth/login` only — the assignment's minimum API list has no signup endpoint, so real users are seeded rather than self-registered (`npm run seed` creates `demo@fitring.app` / `password123`). JWT is a single access token with a long expiry (`JWT_EXPIRES_IN`, default 7d) — deliberately no refresh-token flow, an acceptable simplification for a mock-auth take-home rather than a production system. `requireAuth` (`src/middleware/auth.ts`) is a plain Express middleware function: read the bearer token, verify it with `jsonwebtoken`, attach `req.user`, call `next()`.

## Idempotent health ingestion

`POST /health/readings` takes a **batch**: `{ deviceId, readings: [{ clientUuid, heartRate, spo2, steps, recordedAt }, ...] }`. `clientUuid` is generated on the mobile device at reading-creation time and is the idempotency key — the DB has a unique constraint on `(device_id, client_uuid)`, and the insert uses `ON CONFLICT DO NOTHING`. A retried batch (the mobile sync queue's entire reason for existing) is a safe no-op — verified live: the same two-reading batch posted twice produces exactly 2 rows, not 4. The response reports every submitted `clientUuid` as `accepted`, whether it was newly inserted or already present, so the mobile client always dequeues what it sent — see `health/health.logic.ts` (`ingestReadings`) and its spec.

## Orders

`POST /orders` runs inside a single DB transaction: read the cart, snapshot each product's current price into `order_items.unit_price` (so a later catalog price change never rewrites order history), create the order, then clear the cart. Either all of that happens or none of it does — see `orders/orders.logic.ts` (`placeOrder`) and its spec for the "cart cleared only after the order actually saved" assertion.

## API reference

All routes except `/auth/login`, `GET /products`, and `GET /products/:id` require `Authorization: Bearer <token>`.

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | Returns `{ accessToken, user }` |
| POST | `/devices` | `{ externalId, name }` | `externalId` is the vendor id, e.g. `"FITRING-001"` |
| GET | `/devices` | — | Devices owned by the caller |
| POST | `/health/readings` | `{ deviceId, readings: [...] }` | Batch insert, idempotent — see above |
| GET | `/health/readings` | `?deviceId&before&limit` | Keyset-paginated on `recordedAt`, newest first |
| GET | `/health/summary` | `?deviceId&range=daily\|weekly` | Server-side `date_trunc` aggregation |
| GET | `/products` | — | Public catalog |
| GET | `/products/:id` | — | Public |
| POST | `/cart` | `{ productId, quantity }` | Upsert — sets the line's quantity, not an increment |
| GET | `/cart` | — | Caller's cart + computed total |
| POST | `/orders` | — | Cart → order transaction; 400 if the cart is empty |
| GET | `/orders` | — | Caller's order history, newest first |

## Database

[`src/database/schema.sql`](src/database/schema.sql) is the authoritative schema (mirrors the TypeORM entities in `src/entities/` exactly): `users`, `devices`, `health_readings`, `products`, `cart_items`, `orders`, `order_items`. Two constraints carry the real weight: `unique(device_id, client_uuid)` on `health_readings` (idempotency) and the price snapshot on `order_items` (order-history integrity).

## Testing

```bash
npm test          # unit tests — mocked DataSource, no DB needed
npm run test:e2e  # real HTTP requests via supertest against the actual Express app
```

Unit tests (`*.logic.spec.ts`, colocated with the logic they test, 22 total) cover the areas the assignment explicitly calls out as worth testing:

- **auth** — right/wrong credentials, never revealing which was wrong
- **devices** — `assertDeviceOwnership` returns the device when it's owned by the caller, throws `NotFoundError` when it doesn't exist, and throws `ForbiddenError` when it belongs to someone else (this is the check every device-scoped route relies on — see [Architecture](#architecture)); `createDevice` also rejects a duplicate `externalId` even across users
- **health** — idempotent ingestion (`ON CONFLICT DO NOTHING` on a retried batch), device-ownership enforcement on ingest, and summary rounding
- **cart** — `addOrUpdateCartItem` sets a line's quantity rather than incrementing it, and refuses to add a product that doesn't exist; `findCartForUser`'s total calculation
- **orders** — order-total/atomicity correctness (cart cleared only after the order actually saved, in the same transaction)

The e2e suite (`test/app.e2e-spec.ts`) hits the real Express app through `supertest`, not a mocked framework module.


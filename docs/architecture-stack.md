# Commut.ph — Architecture & Technology Stack

**Status:** MVP, Marikina City jeepney routes
**Stack:** React + TypeScript (Vite), FastAPI + Python, Supabase (PostgreSQL)

Decisions behind this document are recorded in [decisions.md](decisions.md).

## 1. Architecture overview

```text
React + TypeScript web app (src/)
  ├─ Stop picker (type-to-search over known stops)
  └─ Fare result (route, distance, fare, fare matrix source and dates)
          │ HTTPS / JSON  (/v1/...)
          ▼
FastAPI backend (back-end/)
  ├─ Request validation (Pydantic)
  ├─ Per-IP rate limiting (public endpoints)
  ├─ Admin key on write endpoints (until the admin panel's Supabase Auth)
  ├─ Route matching and fare calculation
  └─ SQLAlchemy data access
          │
          ▼
Supabase PostgreSQL
  ├─ stops, routes, route_stops
  ├─ puv_types, fare_matrix_versions, fare_matrix_rows
  └─ saved_fares (+ triggers and a nightly pg_cron job)
```

**Design principle:** the browser only talks to FastAPI, and FastAPI owns fare calculation and database access. Database credentials never reach the browser.

## 2. Technology choices

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + TypeScript (strict) + Vite | Commuter-facing fare checker |
| Backend API | Python + FastAPI + SQLAlchemy | Validation, route matching, fare logic |
| Database | Supabase PostgreSQL | Stops, routes, versioned fare matrices, saved fares |
| Saved fares | `saved_fares` table | Reuse computed fares; survives restarts, shared across API instances |
| Scheduled jobs | `pg_cron` | Retire and purge saved fares nightly |
| Road distances | OpenRouteService (HeiGIT), offline script | Stop-to-stop road distance |

**Deferred:** TanStack Query on the client. Fare lookups are one request per screen and already served from saved fares; add it with the admin panel if its forms need client caching and refetching.

## 3. Request flow (fare estimate)

1. The web app loads the known stops (`GET /v1/stops`) and PUV types (`GET /v1/transport-types`).
2. The user picks an origin and destination from the suggestions (free text is not accepted), a PUV type and a passenger type.
3. The app calls `GET /v1/fares/estimate?origin_stop_id=&destination_stop_id=&puv_type=`.
4. FastAPI checks the per-IP rate limit, validates the stops and PUV type, and finds the fare matrix version in effect.
5. If `saved_fares` has a live row for the trip computed with that version, it is returned as-is.
6. Otherwise FastAPI finds every route of that PUV type passing both stops, sums the road distances between them, looks up the fare in the matrix, and saves the result when every route has a fare.
7. The response includes the routes, distance, regular and discounted fares, and the fare matrix's source, effective date and verification date. The app shows the cheapest priced route.

## 4. Saved fares (server-side cache)

The fare cache is a database table rather than an in-memory cache, so it is shared by every API instance and survives restarts.

- **Key:** origin stop, destination stop, PUV type. At most one live row per trip.
- **Matrix version:** each row records the fare matrix version it was computed with. A row is served only while that version is the one in effect.
- **New fare matrix:** when a newer version takes effect (by its effective date, Manila time), older rows are soft-deleted (`deleted_at`) and recomputed on the next request. Soft-deleted rows are kept 15 days so a retracted matrix can restore them, then deleted by the nightly job.
- **Route or stop changes:** any write to `routes`, `route_stops` or `stops` deletes all saved fares (database triggers), since stops, order or distances may have changed.
- **Incomplete results** (a route whose distances aren't fetched yet, or no matrix in effect) are never saved.

## 5. Rate limiting and security

- **Public endpoints:** per-IP fixed-window limit (`PUBLIC_RATE_LIMIT_PER_MINUTE`, default 60), HTTP `429` with `Retry-After`. It is in-process: with several API instances, move the counters to a shared store (Redis/Valkey).
- **Third-party calls:** OpenRouteService is only called by the offline distance script today. Any future request path that calls it gets a stricter limit; saved fares are always answered first.
- **DDoS:** the in-app limit stops scrapers and request loops, not a volumetric attack; that belongs at the hosting edge (e.g. Cloudflare).
- **Writes:** create / edit / delete endpoints require `X-Admin-Key` (`ADMIN_API_KEY`) and fail closed when no key is configured. Replaced by Supabase Auth with the admin panel.
- **CORS:** only origins in `CORS_ORIGINS` may call the API from a browser.
- **Behind a proxy:** run uvicorn with `--proxy-headers` so the limit sees the real client IP.

## 6. Fare data and response contract

Fare matrices are versioned per PUV type and never edited once published:

- `fare_matrix_versions`: `puv_type`, `status` (draft / published / retracted), `effective_from`, `source_name`, `source_url`, the uploaded PDF, `verified_by`, `verified_at`, `published_at`
- `fare_matrix_rows`: `distance_km`, `regular_fare`, `discounted_fare` per version

The version in effect for a PUV type is the newest published one whose effective date has passed (`current_fare_matrix_version()` in the database).

The estimate response includes the routes (stops in travel order, distance, regular and discounted fare) and the fare matrix in effect (source, effective date, verification date). Trips past the end of a matrix, routes without distances, and PUV types without a matrix return no fare rather than an invented one.

## 7. API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Basic service health check |
| `GET` | `/v1/stops` | Every known stop |
| `GET` | `/v1/transport-types` | Supported PUV types and whether fares are available |
| `GET` | `/v1/fares/estimate` | Fare estimate for an origin and destination stop and PUV type |
| `GET` | `/v1/fare-data/status` | The fare matrix in effect per PUV type, with source and dates |
| `POST/PUT/DELETE` | `/v1/admin/stops/...` | Manage stops (admin) |
| `POST/PUT/DELETE/GET` | `/v1/admin/routes/...` | Manage routes and their ordered stops (admin) |

Planned with the admin panel: fare matrix drafts, PDF parsing, publishing and retraction under `/v1/admin/fare-matrices`, and a read-only saved fares view. FastAPI's OpenAPI docs are at `/docs`.

## 8. Operational basics

- Keep the Supabase connection string and admin key in backend environment variables only.
- Use HTTPS in production and keep staging and production data separate.
- Track request rate, saved-fare hit ratio, API latency, database latency, 4xx/5xx rates, and fare-data freshness (`/v1/fare-data/status`).

## 9. Next

1. Admin panel with Supabase Auth: fare matrix entry (PDF upload, review and edit, publish), stops and routes, saved fares view.
2. Retire the shared admin key once admin login is in place.
3. Shared rate-limit store if the API runs on more than one instance.

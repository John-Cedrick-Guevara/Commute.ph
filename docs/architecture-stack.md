# Commut.ph — Architecture & Technology Stack

**Status:** MVP proposal  
**Primary stack:** React + TypeScript, FastAPI + Python, Supabase (PostgreSQL)

## 1. Architecture overview

```text
React + TypeScript client
  ├─ UI state
  ├─ Client query cache (TanStack Query)
  └─ Request cancellation / retry policy
          │ HTTPS / JSON
          ▼
FastAPI backend
  ├─ Request validation and normalization
  ├─ Rate limiting
  ├─ Server-side cache
  ├─ Fare calculation and route matching
  └─ Supabase repository / data-access layer
          │
          ▼
Supabase PostgreSQL
  ├─ Fare rules and fare matrices
  ├─ Supported routes / route segments
  ├─ Transport types and discounts
  └─ Source, effective date, verification metadata
```

**Design principle:** The client calls FastAPI, and FastAPI owns fare calculation and database access. Do not expose database credentials or privileged Supabase keys in the browser.

## 2. Technology choices

| Layer | Recommended technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript | Responsive commuter-facing UI |
| Client data cache | TanStack Query | Cache responses, deduplicate requests, manage loading/error states |
| Backend API | Python + FastAPI | Validation, fare logic, rate limiting, cache access |
| Database | Supabase PostgreSQL | Persist fare rules, route data, discounts, and provenance |
| Server cache (MVP) | In-process TTL/LRU cache | Avoid repeated database reads for popular fare data |
| Rate limiting (MVP) | FastAPI middleware/dependency with a shared store if deployed across multiple instances | Limit abusive or accidental request bursts |
| Deployment | Static frontend hosting + managed FastAPI hosting | Deploy and scale the UI and API independently |

## 3. Request flow

1. User enters origin, destination, transport type, and passenger category.
2. React validates the input and uses TanStack Query to check its client cache.
3. If no usable cached response exists, the client sends an HTTPS request to FastAPI.
4. FastAPI validates and normalizes the request, then checks the rate limit.
5. FastAPI checks its server cache using a normalized cache key.
6. On a cache hit, return the cached result. On a miss, retrieve the necessary fare/route data from Supabase, calculate the estimate, and cache the result.
7. Return the fare estimate with its currency, assumptions, source/effective date, and verification metadata.
8. TanStack Query caches the response for subsequent client requests.

## 4. Caching strategy

### Client-side cache
Use **TanStack Query** rather than hand-rolling cache state.

- Cache fare-query responses for a short configurable period, such as 1–5 minutes.
- Use a stable query key containing normalized origin, destination, transport type, passenger category, and relevant fare-data version.
- Deduplicate simultaneous identical requests.
- Avoid automatic retries for validation errors and other non-retryable 4xx responses.
- Invalidate relevant queries when the user changes inputs or when the app learns that fare data has changed.

### Server-side cache
Start with a bounded **in-memory TTL/LRU cache** for an MVP deployed as a single FastAPI instance.

- Cache normalized fare data and/or computed fare results.
- Use explicit TTLs and maximum cache size to prevent unbounded memory growth.
- Include a fare-data version or update timestamp in keys where practical.
- Invalidate affected entries when an administrator updates fare data; otherwise keep TTLs short enough to bound staleness.
- Do not cache errors as successful results. Avoid caching personalized or sensitive data unless the cache key and isolation rules are correct.

**Important limitation:** An in-memory cache is local to one process. It is not shared across workers or multiple server instances, and it is cleared on restart. If the API scales horizontally, move to a shared cache such as Redis/Valkey or use a database-backed versioning/invalidation strategy.

### Database-side protection
- Add indexes for route identifiers, transport type, effective dates, and other actual query filters.
- Fetch only the required columns and rows; avoid loading the entire database on each request.
- Keep fare calculation rules in a clear service layer and data retrieval in a repository layer.
- Use connection pooling and set sensible query timeouts.
- Monitor query volume, latency, errors, and Supabase connection usage before adding infrastructure.

## 5. Rate limiting and resilience

Rate limiting is useful, but it is not a replacement for caching or efficient queries.

- Apply per-IP limits to anonymous traffic, with sensible burst and sustained limits.
- Add stricter limits to expensive or malformed query patterns.
- Return HTTP `429 Too Many Requests` with a `Retry-After` header when appropriate.
- If running multiple API instances, use a shared rate-limit store; per-process counters are not globally accurate.
- Add request timeouts and bounded retries for transient failures only.
- Keep database access behind the backend; never let the browser bypass the API for fare queries.
- Add basic request IDs and structured logs to help diagnose slow requests and abuse.

Tune actual rate-limit values after observing expected usage and deployment constraints rather than treating initial values as permanent.

## 6. Fare data and response contract

Store fare data with provenance, not just a numeric amount. Suggested fields include:

- `transport_type`
- `route_id` or route/segment reference
- fare-rule parameters (for example, base fare, distance bands, or per-kilometer rate)
- discount eligibility and calculation rules
- `source_name` and `source_url`
- `effective_from` and optional `effective_until`
- `last_verified_at`
- `data_version` or update timestamp

The API response should include:

- estimated fare and currency
- transport type and route/segment used
- passenger category and applied discount, if any
- calculation basis and assumptions
- source and effective/verification date
- whether the result is an estimate or a confirmed route-specific fare

Do not present a calculated estimate as exact when route-specific fare data is missing or uncertain. Return a clear unsupported/insufficient-data response instead.

## 7. Suggested API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Basic service health check |
| `GET` | `/v1/transport-types` | Supported transport types |
| `GET` | `/v1/fares/estimate` | Estimate fare for normalized origin/destination and passenger category |
| `GET` | `/v1/fare-data/status` | Public freshness/version metadata, if useful |
| `POST` | `/v1/admin/fare-rules` | Protected administrative fare-rule update; not public |

Validate query parameters with Pydantic models and document the contract through FastAPI's OpenAPI docs. Keep admin routes authenticated and authorization-protected.

## 8. Security and operational basics

- Store Supabase service-role credentials only in backend environment secrets. Never ship them to React.
- Use least-privilege database access and authenticated, protected admin operations.
- Validate and normalize all user input; cap input lengths and request sizes.
- Configure CORS for known frontend origins.
- Use HTTPS in production.
- Track request rate, cache-hit ratio, API latency, database latency, 4xx/5xx rates, and fare-data freshness.
- Keep staging and production data/configuration separate.

## 9. MVP implementation order

1. Define the fare and route schema, including source and effective dates.
2. Implement deterministic fare calculation and unit tests.
3. Build FastAPI endpoints and Supabase repository functions.
4. Add request validation, structured errors, timeouts, and basic rate limiting.
5. Add server-side TTL/LRU caching and cache invalidation/versioning.
6. Integrate TanStack Query on the React client.
7. Load-test repeated and varied fare queries; measure cache-hit ratio and database load.
8. Add a shared cache only if multiple instances or observed load make in-memory caching insufficient.

## 10. Senior engineering assessment

The overall idea—async request/response, rate limiting, and caching on both client and server—is appropriate. Keep the architecture boring and measurable.

**Two key cautions:**

1. **Caching correctness matters more than adding cache layers.** Fare data changes over time, so every cached estimate needs a bounded lifetime and a strategy for fare-rule updates.
2. **Rate limiting must match deployment topology.** Per-process limits are acceptable for a single instance, but multi-instance deployments need shared counters to enforce global limits.

For the MVP, use **React + TypeScript + TanStack Query → FastAPI → Supabase PostgreSQL**, with a bounded in-memory server cache. Add Redis/Valkey only when scale, multi-instance consistency, or invalidation requirements justify it.

# PUV Fare Checker — Backend Architecture Guide

## 1. Goal

Return a reliable fare estimate for a PUV trip by matching the user's origin and destination to a known route. Reuse verified route data so repeated requests are fast.

## 2. Core Flow

1. **Resolve endpoints** — Convert the user's origin and destination into known stops or landmarks.
2. **Find a matching route** — Search stored routes using the endpoints, direction, and relevant intermediate stops.
3. **Reuse verified data** — If a saved fare for the trip exists and was computed with the fare matrix in effect, return it.
4. **Build a candidate route** *(planned)* — If no match exists, use road-network data to map a possible path. Treat it as a candidate, not an official route.
5. **Verify route and fare** *(planned)* — Compare the path with the actual PUV route and check the fare against an applicable fare matrix or reliable field verification.
6. **Store the result** — Save the result with the fare matrix version used (`saved_fares`).
7. **Return the response** — Include the route, estimated distance, fare, and verification status.

## 3. High-Level Architecture

```text
Client
  |
  v
Fare Checker API
  |
  +--> Resolve origin and destination
  |
  +--> Search route database
  |       |
  |       +--> Verified match --> Return saved route and fare
  |
  +--> No verified match
          |
          +--> Generate candidate route
          +--> Verify route and fare
          +--> Save only after verification
          +--> Return result or ask for manual review
```

## 4. Main Backend Components

- **Endpoint Resolver:** Matches user input to known stops, landmarks, or coordinates.
- **Route Matcher:** Finds a route that serves both endpoints in the correct direction.
- **Route Mapper:** Uses road-network data to create a candidate path when needed.
- **Fare Service:** Applies the correct fare matrix or fare rules for the PUV type and route.
- **Verification Workflow:** Records evidence and marks routes as pending, verified, or outdated.
- **Route Repository:** Stores route geometry, stops, distance, fare references, and verification metadata.
- **Cache (optional):** Speeds up frequent lookups. The database remains the source of truth.

## 5. Data Model

Built (see `back-end/supabase/migrations`):

### `puv_types`
- `code` (e.g. `traditional_jeepney`, `modern_jeepney`), `label`

### `routes`
- `id`, `route_name`, `puv_type`

### `stops`
- `id`, `name` (unique), `latitude`, `longitude`
- `aliases` — alternative names passengers may use

### `route_stops`
- `route_id`, `stop_id`, `stop_sequence` — order of stops along the route
- `distance_from_previous_km` — road distance from the previous stop, filled by `scripts/fill_segment_distances.py`

### `fare_matrix_versions` + `fare_matrix_rows`
- Version: `puv_type`, `status` (`draft`, `published`, `retracted`), `effective_from`, `source_name`, `source_url`, uploaded PDF, `verified_by`, `verified_at`, `published_at`
- Rows: `distance_km`, `regular_fare`, `discounted_fare`
- A published version is never edited; a fare change publishes a new version, so history is kept.

### `saved_fares`
- `origin_stop_id`, `destination_stop_id`, `puv_type`, `fare_matrix_version_id`, `routes` (the search result), `deleted_at` (soft delete)

Planned:

- `routes.status` (`pending`, `verified`, `outdated`), `source`, `verified_at` — route verification, with the admin panel.
- `routes.geometry` — the mapped path, when candidate routes are generated.

## 6. Matching and Cache Rules

- Match by normalized endpoints, route, direction, and stop sequence—not endpoints alone.
- Reuse only records with `verified` status and currently valid fare data.
- Saved fares record the fare matrix version used and are served only while that version is in effect.
- Route or stop changes delete saved fares; a new fare matrix version retires them (soft delete, kept 15 days for a rollback).
- Do not save an unverified generated path as an official route.

## 7. Accuracy Rules

- Road distance must follow the mapped route, not a straight line between endpoints.
- A mapped path is only a candidate until confirmed against the actual PUV route.
- Distance alone does not prove the official fare. Prefer the applicable fare matrix or verified fare observations.
- Show whether a result is **verified** or **estimated**.
- If no reliable route or fare is available, return “fare not verified” instead of inventing a price.

## 8. MVP Implementation Order

1. ✅ Create a small list of Marikina routes and stops.
2. ⏳ Collect and verify route paths and posted fare matrices (the imported jeepney matrix has no recorded source yet).
3. ✅ Store routes, stop order, and fare sources in the database.
4. ✅ Build endpoint matching and route lookup.
5. ⏳ Add route mapping only for routes not already stored.
6. ✅ Fare validity dates and saved-fare invalidation. ⏳ Route verification status (admin panel).
7. ✅ Test repeated requests, reverse-direction trips and fare updates.

## 9. Key Principle

**Use stored, verified route and fare data first. Generate new routes only when needed, and never treat an automatically mapped path or distance-based calculation as an official fare without verification.**

# PUV Fare Checker — Backend Architecture Guide

## 1. Goal

Return a reliable fare estimate for a PUV trip by matching the user's origin and destination to a known route. Reuse verified route data so repeated requests are fast.

## 2. Core Flow

1. **Resolve endpoints** — Convert the user's origin and destination into known stops or landmarks.
2. **Find a matching route** — Search stored routes using the endpoints, direction, and relevant intermediate stops.
3. **Reuse verified data** — If a valid, verified route and fare record exists, return it.
4. **Build a candidate route** — If no match exists, use road-network data to map a possible path. Treat it as a candidate, not an official route.
5. **Verify route and fare** — Compare the path with the actual PUV route and check the fare against an applicable fare matrix or reliable field verification.
6. **Store the result** — Save the verified route, distance, fare data, source, and verification date.
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

## 5. Suggested Data Model

### `routes`
- `id`
- `name`
- `puv_type`
- `origin_stop_id`
- `destination_stop_id`
- `direction`
- `geometry` — ordered route coordinates
- `distance_km`
- `status` — `pending`, `verified`, `outdated`
- `source`
- `verified_at`

### `route_stops`
- `id`
- `route_id`
- `stop_id`
- `sequence_number` — order of stops along the route

### `stops`
- `id`
- `name`
- `latitude`
- `longitude`
- `aliases` — alternative names passengers may use

### `fare_rules` or `fare_matrices`
- `id`
- `route_id` or applicable route/PUV scope
- `puv_type`
- `fare_data` — matrix or rule reference
- `source`
- `effective_from`
- `effective_until`
- `verified_at`

Keep fare data versioned so a fare change does not silently overwrite the historical record.

## 6. Matching and Cache Rules

- Match by normalized endpoints, route, direction, and stop sequence—not endpoints alone.
- Reuse only records with `verified` status and currently valid fare data.
- Cache keys should include the route/direction and fare-data version where relevant.
- Expire or invalidate cached results when route geometry or fare rules change.
- Do not save an unverified generated path as an official route.

## 7. Accuracy Rules

- Road distance must follow the mapped route, not a straight line between endpoints.
- A mapped path is only a candidate until confirmed against the actual PUV route.
- Distance alone does not prove the official fare. Prefer the applicable fare matrix or verified fare observations.
- Show whether a result is **verified** or **estimated**.
- If no reliable route or fare is available, return “fare not verified” instead of inventing a price.

## 8. MVP Implementation Order

1. Create a small list of Marikina routes and stops.
2. Collect and verify route paths and posted fare matrices.
3. Store routes, stop order, and fare sources in the database.
4. Build endpoint matching and route lookup.
5. Add route mapping only for routes not already stored.
6. Add verification status, fare validity dates, and cache invalidation.
7. Test repeated requests, reverse-direction trips, ambiguous endpoints, and fare updates.

## 9. Key Principle

**Use stored, verified route and fare data first. Generate new routes only when needed, and never treat an automatically mapped path or distance-based calculation as an official fare without verification.**

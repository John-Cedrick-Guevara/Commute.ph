# Commute.ph

Jeepney fare checker for Marikina City. Pick a starting stop and a destination, and it shows the route that connects them, the road distance, and the regular or discounted (student / senior citizen / PWD) fare.

Only stops on stored routes can be chosen; fares come from the versioned fare matrix in effect for the PUV type, and each result shows the matrix's source and effective date.

## Stack

| Part | Tech |
| --- | --- |
| Web app | React 18 + TypeScript + Vite (`src/`) |
| API | FastAPI + SQLAlchemy (`back-end/`) |
| Database | Supabase Postgres (migrations in `back-end/supabase/migrations`) |
| Road distances | OpenRouteService (HeiGIT) |

## Setup

Requirements: Node 18+, Python 3.10+, and the Supabase project's connection string.

```bash
npm install && cp .env.example .env   # then fill in the Supabase URL and publishable key
```

```bash
cd back-end && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Create `back-end/.env`:

```bash
SUPABASE_URL=...                # project URL
SUPABASE_CONNECTION_STRING=...  # Postgres connection string
HEIGIT_KEY=...                  # OpenRouteService key, only for the distance script
CORS_ORIGINS=http://localhost:5173        # optional; web app origins allowed to call the API
PUBLIC_RATE_LIMIT_PER_MINUTE=60           # optional; per-IP limit on public endpoints
```

Behind a reverse proxy, start uvicorn with `--proxy-headers` so rate limiting sees the real client IP.

## Run locally

Start the API and the web app in two terminals:

```bash
npm run api   # FastAPI on http://localhost:8000 (docs at /docs)
```

```bash
npm run dev   # web app on http://localhost:5173, proxies /api to the API
```

For a deployed web app, set `VITE_API_URL` to the API's origin.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/stops` | Every known stop, for the stop picker |
| `GET /v1/transport-types` | PUV types and whether fares are available for each |
| `GET /v1/fares/estimate?origin_stop_id=&destination_stop_id=&puv_type=` | The fare matrix in effect and every route of that PUV type connecting the two stops, with stops in travel order, distance and fares |
| `GET /v1/fare-data/status` | The fare matrix in effect per PUV type, with source and dates |
| `GET /health` | Liveness check |
| `/v1/admin/...` | Admin: fare matrices, stops, routes, saved fares (Supabase admin login) |

Public endpoints are rate limited per IP (HTTP 429 with `Retry-After` when exceeded).

### Fare matrices and saved fares

- Each PUV type (`puv_types`) has versioned fare matrices (`fare_matrix_versions` + `fare_matrix_rows`) with source and effective date. The version in effect is the newest published one whose effective date (Manila time) has passed.
- A trip's result is saved in `saved_fares` with the matrix version used and reused while that version is in effect. When a newer version takes effect, the old saved fares are soft-deleted (kept 15 days for a rollback) and recomputed on the next request. A nightly `pg_cron` job retires them and deletes ones older than 15 days.
- Any change to `routes`, `route_stops` or `stops` deletes all saved fares.

## Admin panel

Open `/admin` in the web app and sign in with a Supabase account that has the admin role. To make an account an admin:

1. Supabase dashboard → Authentication → Users → **Add user** (email and password).
2. In the SQL editor, run (with the account's email):

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   where email = 'admin@example.com';
   ```
3. Sign in at `/admin` (sign out and in again if you were already signed in).

The admin panel covers:

- **Fare matrices:** start a draft, upload the fare matrix PDF (its rows are read without AI and filled into the table), review and edit every row or paste them from a spreadsheet, fix the checks, then publish. Before publishing it shows how many saved fares will retire and when. A published matrix can't be edited; retract it to bring the previous one back.
- **Stops and routes:** create, edit and delete; set a route's stops in travel order.
- **Saved fares:** read-only.

## Data

- **Migrations:** add a file to `back-end/supabase/migrations`, then from `back-end/` run `supabase db push`.
- **Stop coordinates:** fill `back-end/supabase/seed/stop_coordinates.sql` and run it in the Supabase SQL editor.
- **Road distances:** fetch missing stop-to-stop distances (a route has no fare until they are filled):

  ```bash
  cd back-end && .venv/bin/python -m scripts.fill_segment_distances
  ```

## Tests

The API tests run against the database in `back-end/.env` and clean up the data they create.

```bash
cd back-end && .venv/bin/python -m pytest
```

```bash
npm run typecheck
```

## Docs

- [Decisions](docs/decisions.md)
- [Product requirements](docs/PRD.md)
- [Architecture and stack](docs/architecture-stack.md)
- [Back-end flow](docs/back-end-flow-idea.md)

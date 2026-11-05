# Commute.ph

Jeepney fare checker for Marikina City. Pick a starting stop and a destination, and it shows the route that connects them, the road distance, and the regular or discounted (student / senior citizen / PWD) fare.

Only stops on stored routes can be chosen; fares come from the jeepney fare matrix in the database.

## Stack

| Part | Tech |
| --- | --- |
| Web app | React 18 + Vite (`src/`) |
| API | FastAPI + SQLAlchemy (`back-end/`) |
| Database | Supabase Postgres (migrations in `back-end/supabase/migrations`) |
| Road distances | OpenRouteService (HeiGIT) |

## Setup

Requirements: Node 18+, Python 3.10+, and the Supabase project's connection string.

```bash
npm install
```

```bash
cd back-end && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Create `back-end/.env`:

```bash
SUPABASE_URL=...                # project URL
SUPABASE_CONNECTION_STRING=...  # Postgres connection string
HEIGIT_KEY=...                  # OpenRouteService key, only for the distance script
```

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
| `GET /route-points/` | Every known stop, one per name, for the stop picker |
| `GET /fair/routes?start_point_id=&end_point_id=` | Routes connecting two stops, with stops in travel order, distance and fares |
| `POST/PUT/DELETE /routes/...` | Manage routes |
| `POST/PUT/DELETE /route-points/...` | Manage stops on a route |

Fare results are saved in `saved_fares` per stop pair and reused on the next request. Any change to `routes`, `route_points` or `fare_matrix` clears them (database triggers), so saved fares stay current.

## Data

- **Migrations:** add a file to `back-end/supabase/migrations`, then from `back-end/` run `supabase db push`.
- **Stop coordinates:** fill `back-end/supabase/seed/route_points_coordinates.sql` and run it in the Supabase SQL editor.
- **Road distances:** fetch missing stop-to-stop distances (a route has no fare until they are filled):

  ```bash
  cd back-end && .venv/bin/python -m scripts.fill_segment_distances
  ```

## Tests

The tests run against the database in `back-end/.env` and clean up the data they create.

```bash
cd back-end && .venv/bin/python -m pytest
```

## Docs

- [Product requirements](docs/PRD.md)
- [Architecture and stack](docs/architecture-stack.md)
- [Back-end flow](docs/back-end-flow-idea.md)

# Decisions

Agreed 2026-11-05 to resolve where the docs and the code disagreed. Each line says which side wins.

| # | Topic | Decision |
|---|---|---|
| 1 | Coverage | **Marikina only.** The PRD's Metro Manila / bus scope is narrowed to Marikina routes. |
| 2 | Fare provenance | **Docs win.** Fare matrices record PUV type (traditional jeepney, bus, …), effective date, source and verification date. |
| 3 | Beep Jeep | **Keep the option.** Its official fare source isn't available yet, so it must say "fare not available yet" instead of borrowing the jeepney fare. |
| 4 | Updating fare matrices | **Admin panel (planned).** Until then, fare changes go through migrations. |
| 5 | Frontend language | **Switch to TypeScript.** |
| 6 | Server cache | **Code wins.** Fares are saved in the `saved_fares` table, not an in-memory cache. Docs to be updated. |
| 7 | CORS / rate limiting | **Add CORS.** Saved fares are returned directly. Strict limits on anything that calls a third-party API (OpenRouteService); a general per-IP limit on public endpoints. |
| 8 | API endpoints | **Docs win.** Move to the `/v1/...` endpoints in `architecture-stack.md`. |
| 9 | Admin authentication | **With the admin panel.** |
| 10 | Data model | **Docs win.** A separate `stops` table, and routes that carry their PUV type. |

## Data model

- `stops`: one row per real-world place (name, coordinates, aliases).
- `route_stops`: a route's stops in order (route, stop, sequence, distance from the previous stop).
- Routes connect through shared stop IDs, not matching names. Saved fares are keyed by stop IDs.

## Admin panel

- **Fare matrix upload:** the admin uploads the PDF; a parser (no LLM) fills an editable table. The admin checks and edits it, the app validates the numbers (fares never go down as distance goes up, discount ≈ 20%), and only then publishes. Until published it is a **draft** and is never used for fares. Manual entry / CSV paste is available when the PDF can't be parsed. The PDF is kept as the version's source document.
- **Versions:** a published matrix is never edited; changes publish a new version with PUV type, effective date, source and verifier. The current version per PUV type is the newest one already in effect.
- **Saved fares:** one row per stop pair per route, recording the matrix version used. When a new version takes effect, older saved fares are no longer served (soft-deleted), stay recoverable for 15 days in case of a rollback, then are deleted. The admin sees a notice of how many saved fares will be retired, and when, before publishing.
- **Stops and routes:** full create / edit / delete. **Saved fares:** view only.
- **Authentication:** Supabase Auth for admins. Until then, write endpoints require an admin key header.

## Open

- App name: the UI says "Sakay", the docs say "Commut.ph", the repo is "Commute.ph".

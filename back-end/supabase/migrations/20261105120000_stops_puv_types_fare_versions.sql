-- Stops, PUV types and versioned fare matrices (docs/decisions.md #2, #10).
-- Moves route_points -> stops + route_stops and fare_matrix -> fare_matrix_versions + fare_matrix_rows,
-- and rebuilds saved_fares to track the matrix version each saved fare was computed with.

-- ---------------------------------------------------------------- PUV types

create table puv_types (
    code text primary key,
    label text not null,
    created_at timestamp default now()
);

insert into puv_types (code, label) values
    ('traditional_jeepney', 'Traditional Jeepney'),
    ('modern_jeepney', 'Beep Jeep (Modern Jeepney)');

alter table puv_types enable row level security;
create policy "Allow read" on puv_types for select to anon, authenticated using (true);

-- Every existing route is a traditional jeepney route; new routes must say their type
alter table routes add column puv_type text references puv_types(code);
update routes set puv_type = 'traditional_jeepney';
alter table routes alter column puv_type set not null;
create index idx_routes_puv_type on routes(puv_type);

-- ---------------------------------------------------------------- Stops

-- One row per real-world place, shared by every route that passes it
create table stops (
    id uuid primary key default gen_random_uuid(),

    name text not null unique,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    -- Other names passengers use, matched by the stop search
    aliases text[] not null default '{}',

    created_at timestamp default now(),
    updated_at timestamp default now()
);

-- A route's stops in travel order
create table route_stops (
    id uuid primary key default gen_random_uuid(),

    route_id uuid not null references routes(id) on delete cascade,
    -- A stop used by a route can't be deleted until it's removed from the route
    stop_id uuid not null references stops(id) on delete restrict,
    stop_sequence integer not null check (stop_sequence > 0),

    -- Road distance from the previous stop on this route; null until fetched
    distance_from_previous_km numeric(7, 3) check (distance_from_previous_km >= 0),

    created_at timestamp default now(),
    updated_at timestamp default now(),

    unique (route_id, stop_sequence)
);

create index idx_route_stops_stop_id on route_stops(stop_id);

insert into stops (name, latitude, longitude)
select distinct on (point_name) point_name, latitude, longitude
from route_points
order by point_name, created_at;

insert into route_stops (route_id, stop_id, stop_sequence, distance_from_previous_km)
select rp.route_id, s.id, rp.stop_sequence, rp.distance_from_previous_km
from route_points rp
join stops s on s.name = rp.point_name;

drop table route_points;

alter table stops enable row level security;
create policy "Allow read" on stops for select to anon, authenticated using (true);
alter table route_stops enable row level security;
create policy "Allow read" on route_stops for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- Fare matrix versions

-- A published version is never edited; a fare change publishes a new version.
-- draft: being entered or reviewed, never used for fares
-- published: in use from effective_from (Manila date)
-- retracted: withdrawn (e.g. entered wrong); the previous version applies again
create table fare_matrix_versions (
    id uuid primary key default gen_random_uuid(),

    puv_type text not null references puv_types(code),
    status text not null default 'draft' check (status in ('draft', 'published', 'retracted')),
    effective_from date,

    source_name text,
    source_url text,
    -- The uploaded fare matrix PDF
    -- ponytail: stored in the row; move to Supabase Storage if files get large
    source_file bytea,
    source_file_name text,

    verified_by text,
    verified_at timestamp,
    published_at timestamp,

    created_at timestamp default now(),
    updated_at timestamp default now(),

    check (status = 'draft' or (effective_from is not null and source_name is not null))
);

create index idx_fare_matrix_versions_lookup on fare_matrix_versions(puv_type, status, effective_from);

create table fare_matrix_rows (
    version_id uuid not null references fare_matrix_versions(id) on delete cascade,
    distance_km integer not null check (distance_km > 0),

    regular_fare numeric(6, 2) not null check (regular_fare > 0),
    -- Student / senior citizen / PWD fare
    discounted_fare numeric(6, 2) not null check (discounted_fare > 0 and discounted_fare <= regular_fare),

    primary key (version_id, distance_km)
);

-- The existing jeepney matrix becomes version 1. Its official effective date and source
-- weren't recorded, so the import date stands in until an admin publishes a sourced version.
with imported as (
    insert into fare_matrix_versions (puv_type, status, effective_from, source_name, published_at)
    values ('traditional_jeepney', 'published', '2026-11-04',
            'Imported from the original fare_matrix table (source not recorded)', now())
    returning id
)
insert into fare_matrix_rows (version_id, distance_km, regular_fare, discounted_fare)
select imported.id, fm.distance_km, fm.regular_fare, fm.discounted_fare
from imported, fare_matrix fm;

drop table fare_matrix;

alter table fare_matrix_versions enable row level security;
alter table fare_matrix_rows enable row level security;

-- The version in effect today (Manila time) for a PUV type, or null if it has none
create function current_fare_matrix_version(p_puv_type text) returns uuid
language sql stable as $$
    select id
    from fare_matrix_versions
    where puv_type = p_puv_type
      and status = 'published'
      and effective_from <= (now() at time zone 'Asia/Manila')::date
    order by effective_from desc, published_at desc
    limit 1
$$;

-- ---------------------------------------------------------------- Saved fares

-- The route_points and fare_matrix triggers went with their tables above
drop trigger clear_saved_fares on routes;
drop table saved_fares;
drop function clear_saved_fares();

-- A fare search result for a stop pair and PUV type, computed with one matrix version.
-- deleted_at set = soft-deleted: no longer served, kept 15 days so a retracted matrix can restore it.
create table saved_fares (
    id uuid primary key default gen_random_uuid(),

    origin_stop_id uuid not null references stops(id) on delete cascade,
    destination_stop_id uuid not null references stops(id) on delete cascade,
    puv_type text not null references puv_types(code),
    fare_matrix_version_id uuid not null references fare_matrix_versions(id) on delete cascade,

    -- The search response: matching routes with their stops, distance and fares
    routes jsonb not null,

    created_at timestamp default now(),
    deleted_at timestamp
);

-- At most one live saved fare per trip
create unique index uq_saved_fares_live on saved_fares(origin_stop_id, destination_stop_id, puv_type)
    where deleted_at is null;
create index idx_saved_fares_version on saved_fares(fare_matrix_version_id);

alter table saved_fares enable row level security;

-- Route or stop changes make saved results wrong (stops, order or distances moved), so they are
-- deleted outright; fare matrix changes go through versions instead.
-- ponytail: clears every saved fare on any change; scope it per route if edits become frequent
create function clear_saved_fares() returns trigger
language plpgsql as $$
begin
    delete from saved_fares;
    return null;
end;
$$;

create trigger clear_saved_fares after insert or update or delete or truncate on routes
    for each statement execute function clear_saved_fares();
create trigger clear_saved_fares after insert or update or delete or truncate on route_stops
    for each statement execute function clear_saved_fares();
create trigger clear_saved_fares after insert or update or delete or truncate on stops
    for each statement execute function clear_saved_fares();

-- Soft-delete live saved fares whose matrix version is no longer the one in effect
create function retire_saved_fares() returns integer
language sql as $$
    with retired as (
        update saved_fares
        set deleted_at = now()
        where deleted_at is null
          and fare_matrix_version_id is distinct from current_fare_matrix_version(puv_type)
        returning 1
    )
    select count(*)::integer from retired
$$;

-- Nightly, just after midnight Manila time (16:05 UTC): retire saved fares when a new matrix takes
-- effect, and permanently delete ones soft-deleted more than 15 days ago
create extension if not exists pg_cron;

select cron.schedule(
    'saved-fares-maintenance',
    '5 16 * * *',
    $$ select retire_saved_fares(); delete from saved_fares where deleted_at < now() - interval '15 days'; $$
);

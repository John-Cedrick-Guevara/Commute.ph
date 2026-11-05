import logging
import math
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, aliased

from app.fair.model import FareMatrixRow, FareMatrixVersion, PuvType, SavedFare
from app.fair.schema import RouteMatchSchema
from app.routes.model import Route
from app.stops.model import RouteStop, Stop

logger = logging.getLogger(__name__)


def compute_fare(
    distance_km: Decimal, fares: dict[int, FareMatrixRow]
) -> tuple[Decimal, Decimal] | None:
    """
    Get the (regular, discounted) fare for a distance, or None when the distance is past the
    fare matrix (no fare is invented). Partial kilometers are rounded up, with a minimum of 1 km.
    """
    km = max(1, math.ceil(distance_km))
    row = fares.get(km)
    return (row.regular_fare, row.discounted_fare) if row else None


def current_version_id(db: Session, puv_type: str) -> uuid.UUID | None:
    """The fare matrix version in effect today (Manila time) for a PUV type."""
    return db.execute(select(func.current_fare_matrix_version(puv_type))).scalar()


def list_transport_types(db: Session) -> list[dict]:
    """Every PUV type, with whether a fare matrix is in effect for it."""
    return [
        {"code": t.code, "label": t.label, "has_fare_matrix": current_version_id(db, t.code) is not None}
        for t in db.execute(select(PuvType).order_by(PuvType.label)).scalars()
    ]


def fare_data_status(db: Session) -> list[dict]:
    """The fare matrix in effect for every PUV type, with its source and dates."""
    return [
        {"puv_type": t.code, "label": t.label, "fare_matrix": version_info(db, current_version_id(db, t.code))}
        for t in db.execute(select(PuvType).order_by(PuvType.label)).scalars()
    ]


def version_info(db: Session, version_id: uuid.UUID | None) -> FareMatrixVersion | None:
    return db.get(FareMatrixVersion, version_id) if version_id else None


def estimate_fare(db: Session, origin_id: uuid.UUID, destination_id: uuid.UUID, puv_type: str) -> dict:
    """The fare estimate response: the matrix in effect and the matching routes."""
    routes = get_routes_between_stops(db, origin_id, destination_id, puv_type)
    return {
        "origin_stop_id": origin_id,
        "destination_stop_id": destination_id,
        "puv_type": puv_type,
        "fare_matrix": version_info(db, current_version_id(db, puv_type)),
        "routes": routes,
    }


def get_routes_between_stops(
    db: Session, origin_id: uuid.UUID, destination_id: uuid.UUID, puv_type: str
) -> list[dict]:
    """
    Get every route of a PUV type that passes both stops (in either direction), with the stops
    from origin to destination in travel order and the fare.
    A result saved with the fare matrix version in effect is returned without searching again.
    """
    if origin_id == destination_id:
        raise HTTPException(status_code=400, detail="Origin and destination must be different")

    found = set(db.execute(select(Stop.id).where(Stop.id.in_([origin_id, destination_id]))).scalars())
    for stop_id in (origin_id, destination_id):
        if stop_id not in found:
            raise HTTPException(status_code=404, detail=f"Stop with ID {stop_id} not found")
    if db.get(PuvType, puv_type) is None:
        raise HTTPException(status_code=404, detail=f"Unknown PUV type {puv_type!r}")

    version_id = current_version_id(db, puv_type)

    saved = db.execute(
        select(SavedFare).where(
            SavedFare.origin_stop_id == origin_id,
            SavedFare.destination_stop_id == destination_id,
            SavedFare.puv_type == puv_type,
            SavedFare.deleted_at.is_(None),
        )
    ).scalar()
    if saved is not None:
        if saved.fare_matrix_version_id == version_id:
            return saved.routes
        # A newer matrix took effect since it was saved: retire it (kept 15 days for a rollback)
        saved.deleted_at = datetime.now()
        db.commit()

    routes = search_routes(db, origin_id, destination_id, puv_type, version_id)

    # Save only complete results: a route without a fare yet (distances not fetched) must be
    # searched again later; with no matrix in effect there is nothing to save
    if version_id is not None and all(route["regular_fare"] is not None for route in routes):
        save_result(db, origin_id, destination_id, puv_type, version_id, routes)

    return routes


def save_result(
    db: Session, origin_id: uuid.UUID, destination_id: uuid.UUID, puv_type: str,
    version_id: uuid.UUID, routes: list[dict],
) -> None:
    try:
        # Two first-time requests for the same trip may race; the first insert wins
        db.execute(
            insert(SavedFare)
            .values(
                origin_stop_id=origin_id, destination_stop_id=destination_id, puv_type=puv_type,
                fare_matrix_version_id=version_id, routes=routes,
            )
            .on_conflict_do_nothing()
        )
        db.commit()
    except Exception:
        # Saving is an optimization; still answer the request if it fails
        db.rollback()
        logger.exception("Failed to save fare for %s -> %s (%s)", origin_id, destination_id, puv_type)


def search_routes(
    db: Session, origin_id: uuid.UUID, destination_id: uuid.UUID, puv_type: str,
    version_id: uuid.UUID | None,
) -> list[dict]:
    """
    Run the route search and fare computation for two stops.
    Returns JSON-ready dicts in the response shape, so they can be saved as-is.
    """
    origin = aliased(RouteStop)
    destination = aliased(RouteStop)

    matching_routes = (
        select(
            origin.route_id,
            origin.stop_sequence.label("origin_sequence"),
            destination.stop_sequence.label("destination_sequence"),
            func.least(origin.stop_sequence, destination.stop_sequence).label("low_sequence"),
            func.greatest(origin.stop_sequence, destination.stop_sequence).label("high_sequence"),
        )
        # Both stops on the same route of the requested PUV type, in any order
        # ponytail: a route passing the same stop twice (loop) matches once per pair, dedupe if loops are added
        .join(destination, destination.route_id == origin.route_id)
        .join(Route, Route.id == origin.route_id)
        .where(
            origin.stop_id == origin_id,
            destination.stop_id == destination_id,
            Route.puv_type == puv_type,
        )
    ).subquery()

    # The stops between origin and destination of each matching route. Reversed trips
    # (origin after destination) are ordered backwards so the list follows travel order.
    route_query = (
        select(RouteStop, Stop, Route)
        .join(matching_routes, matching_routes.c.route_id == RouteStop.route_id)
        .join(Stop, Stop.id == RouteStop.stop_id)
        .join(Route, Route.id == RouteStop.route_id)
        .where(RouteStop.stop_sequence.between(matching_routes.c.low_sequence, matching_routes.c.high_sequence))
        .order_by(
            Route.route_name,
            Route.id,
            case(
                (matching_routes.c.origin_sequence < matching_routes.c.destination_sequence, RouteStop.stop_sequence),
                else_=-RouteStop.stop_sequence,
            ),
        )
    )

    # Group the flat rows into one entry per route
    routes: dict[uuid.UUID, dict] = {}
    for route_stop, stop, route in db.execute(route_query).all():
        entry = routes.setdefault(route.id, {
            "route_id": route.id, "route_name": route.route_name, "puv_type": route.puv_type,
            "stops": [], "segments": [],
        })
        entry["stops"].append({
            "stop_id": stop.id, "name": stop.name, "latitude": stop.latitude,
            "longitude": stop.longitude, "stop_sequence": route_stop.stop_sequence,
        })
        entry["segments"].append((route_stop.stop_sequence, route_stop.distance_from_previous_km))

    fares = {}
    if version_id is not None:
        fares = {
            row.distance_km: row
            for row in db.execute(select(FareMatrixRow).where(FareMatrixRow.version_id == version_id)).scalars()
        }

    for route in routes.values():
        # Each stop stores the distance from the previous stop, so the trip distance is the
        # sum over every stop except the lowest-sequence one, in either direction
        segments = sorted(route.pop("segments"))[1:]
        distances = [km for _, km in segments]
        distance = None if None in distances else sum(distances, Decimal(0))
        fare = compute_fare(distance, fares) if distance is not None and fares else None

        route.update(
            distance_km=distance,
            regular_fare=fare[0] if fare else None,
            discounted_fare=fare[1] if fare else None,
            fare_matrix_version_id=version_id if fare else None,
        )

    return [RouteMatchSchema.model_validate(route).model_dump(mode="json") for route in routes.values()]

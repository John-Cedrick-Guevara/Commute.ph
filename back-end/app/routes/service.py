import uuid

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.fair.model import PuvType
from app.routes import schema
from app.routes.model import Route
from app.stops.model import RouteStop, Stop


def get_route(session: Session, route_id: uuid.UUID) -> Route:
    route = session.get(Route, route_id)
    if route is None:
        raise HTTPException(status_code=404, detail=f"Route with ID {route_id} not found")
    return route


def check_puv_type(session: Session, code: str) -> None:
    if session.get(PuvType, code) is None:
        raise HTTPException(status_code=422, detail=f"Unknown PUV type {code!r}")


def commit(session: Session) -> None:
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise


def create_route(session: Session, route_data: schema.RouteCreate) -> Route:
    check_puv_type(session, route_data.puv_type)
    new_route = Route(**route_data.model_dump())
    session.add(new_route)
    commit(session)
    session.refresh(new_route)
    return new_route


def delete_route(session: Session, route_id: uuid.UUID) -> None:
    session.delete(get_route(session, route_id))
    commit(session)


def update_route(session: Session, route_id: uuid.UUID, route_data: schema.RouteEdit) -> Route:
    route = get_route(session, route_id)
    check_puv_type(session, route_data.puv_type)
    route.route_name = route_data.route_name
    route.puv_type = route_data.puv_type
    commit(session)
    session.refresh(route)
    return route


def get_route_detail(session: Session, route_id: uuid.UUID) -> dict:
    """A route with its stops in travel order."""
    route = get_route(session, route_id)
    rows = session.execute(
        select(RouteStop, Stop.name)
        .join(Stop, Stop.id == RouteStop.stop_id)
        .where(RouteStop.route_id == route_id)
        .order_by(RouteStop.stop_sequence)
    ).all()
    return {
        "id": route.id,
        "route_name": route.route_name,
        "puv_type": route.puv_type,
        "stops": [
            {
                "stop_id": rs.stop_id,
                "name": name,
                "stop_sequence": rs.stop_sequence,
                "distance_from_previous_km": rs.distance_from_previous_km,
            }
            for rs, name in rows
        ],
    }


def set_route_stops(session: Session, route_id: uuid.UUID, stop_ids: list[uuid.UUID]) -> dict:
    """
    Replace a route's stops with the given ordered list.
    A segment keeps its fetched road distance when the same two stops are still consecutive.
    """
    get_route(session, route_id)

    found = set(session.execute(select(Stop.id).where(Stop.id.in_(stop_ids))).scalars())
    missing = [str(s) for s in stop_ids if s not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Stops not found: {', '.join(missing)}")

    old = session.execute(
        select(RouteStop).where(RouteStop.route_id == route_id).order_by(RouteStop.stop_sequence)
    ).scalars().all()
    known_distances = {
        (previous.stop_id, current.stop_id): current.distance_from_previous_km
        for previous, current in zip(old, old[1:])
    }

    session.execute(delete(RouteStop).where(RouteStop.route_id == route_id))
    for sequence, stop_id in enumerate(stop_ids, 1):
        previous_id = stop_ids[sequence - 2] if sequence > 1 else None
        session.add(RouteStop(
            route_id=route_id,
            stop_id=stop_id,
            stop_sequence=sequence,
            distance_from_previous_km=known_distances.get((previous_id, stop_id)),
        ))
    commit(session)
    return get_route_detail(session, route_id)

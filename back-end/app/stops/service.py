import uuid

from fastapi import HTTPException
from sqlalchemy import and_, exists, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.stops import schema
from app.stops.model import RouteStop, Stop


def list_stops(session: Session) -> list[Stop]:
    """Every stop, sorted by name, for the stop picker."""
    # ponytail: unpaginated; add search/paging if stops reach the thousands
    return list(session.execute(select(Stop).order_by(Stop.name)).scalars())


def get_stop(session: Session, stop_id: uuid.UUID) -> Stop:
    stop = session.get(Stop, stop_id)
    if stop is None:
        raise HTTPException(status_code=404, detail=f"Stop with ID {stop_id} not found")
    return stop


def commit_or_conflict(session: Session, message: str) -> None:
    """Commit, turning a unique / foreign key violation into a 409 with a readable message."""
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail=message)
    except Exception:
        session.rollback()
        raise


def create_stop(session: Session, data: schema.StopCreate) -> Stop:
    stop = Stop(**data.model_dump())
    session.add(stop)
    commit_or_conflict(session, f"A stop named {data.name!r} already exists")
    session.refresh(stop)
    return stop


def clear_distances_around(session: Session, stop_id: uuid.UUID) -> None:
    """
    Clear the road distances of every route segment that starts or ends at a stop,
    so the distance script refetches them after the stop moved.
    """
    previous = aliased(RouteStop)
    session.execute(
        update(RouteStop)
        .where(
            (RouteStop.stop_id == stop_id)
            | exists().where(
                and_(
                    previous.route_id == RouteStop.route_id,
                    previous.stop_sequence == RouteStop.stop_sequence - 1,
                    previous.stop_id == stop_id,
                )
            )
        )
        .values(distance_from_previous_km=None)
    )


def update_stop(session: Session, stop_id: uuid.UUID, data: schema.StopEdit) -> Stop:
    stop = get_stop(session, stop_id)
    moved = (stop.latitude, stop.longitude) != (data.latitude, data.longitude)

    for field, value in data.model_dump().items():
        setattr(stop, field, value)
    if moved:
        clear_distances_around(session, stop_id)

    commit_or_conflict(session, f"A stop named {data.name!r} already exists")
    session.refresh(stop)
    return stop


def delete_stop(session: Session, stop_id: uuid.UUID) -> None:
    stop = get_stop(session, stop_id)
    session.delete(stop)
    commit_or_conflict(session, "This stop is used by a route. Remove it from the route first.")

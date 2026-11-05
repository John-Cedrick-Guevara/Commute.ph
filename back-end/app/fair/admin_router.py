import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.db.database import get_db
from app.fair.model import FareMatrixVersion, SavedFare
from app.security import require_admin
from app.stops.model import Stop

router = APIRouter(prefix="/v1/admin/saved-fares", tags=["admin: saved fares"], dependencies=[Depends(require_admin)])


class SavedFareSchema(BaseModel):
    id: uuid.UUID
    origin: str
    destination: str
    puv_type: str
    fare_matrix_version_id: uuid.UUID
    fare_matrix_effective_from: date | None
    route_count: int
    cheapest_regular_fare: float | None
    created_at: datetime
    deleted_at: datetime | None


@router.get("", response_model=list[SavedFareSchema])
def list_saved_fares(
    session: Annotated[Session, Depends(get_db)],
    include_deleted: bool = False,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    """
    View saved fares (read-only), newest first. Soft-deleted ones are kept 15 days after a new
    fare matrix takes effect.

    :param include_deleted: Also list soft-deleted saved fares
    :param limit: How many to return
    :param session: SQLAlchemy session object
    :return: The saved fares
    """
    origin, destination = aliased(Stop), aliased(Stop)
    query = (
        select(SavedFare, origin.name, destination.name, FareMatrixVersion.effective_from)
        .join(origin, origin.id == SavedFare.origin_stop_id)
        .join(destination, destination.id == SavedFare.destination_stop_id)
        .join(FareMatrixVersion, FareMatrixVersion.id == SavedFare.fare_matrix_version_id)
        .order_by(SavedFare.created_at.desc())
        .limit(limit)
    )
    if not include_deleted:
        query = query.where(SavedFare.deleted_at.is_(None))

    return [
        {
            "id": fare.id, "origin": origin_name, "destination": destination_name,
            "puv_type": fare.puv_type, "fare_matrix_version_id": fare.fare_matrix_version_id,
            "fare_matrix_effective_from": effective_from, "route_count": len(fare.routes),
            "cheapest_regular_fare": min((r["regular_fare"] for r in fare.routes), default=None),
            "created_at": fare.created_at, "deleted_at": fare.deleted_at,
        }
        for fare, origin_name, destination_name, effective_from in session.execute(query).all()
    ]

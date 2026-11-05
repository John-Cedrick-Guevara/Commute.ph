import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.security import public_rate_limit
from app.fair import schema, services

router = APIRouter(
    prefix="/v1",
    tags=["fares"],
    dependencies=[Depends(public_rate_limit)],
)


@router.get("/fares/estimate", response_model=schema.FareEstimateSchema, status_code=status.HTTP_200_OK)
def estimate_fare(
    origin_stop_id: uuid.UUID,
    destination_stop_id: uuid.UUID,
    puv_type: str,
    session: Annotated[Session, Depends(get_db)],
):
    """
    Estimate the fare between two stops for a PUV type: every route of that type passing both
    stops, with the stops from origin to destination, distance and fares.

    :param origin_stop_id: The ID of the starting stop
    :param destination_stop_id: The ID of the destination stop
    :param puv_type: The PUV type code, e.g. traditional_jeepney
    :param session: SQLAlchemy session object
    :return: The fare matrix in effect and the matching routes
    """
    return services.estimate_fare(session, origin_stop_id, destination_stop_id, puv_type)


@router.get("/transport-types", response_model=list[schema.TransportTypeSchema])
def list_transport_types(session: Annotated[Session, Depends(get_db)]):
    """
    List the supported PUV types and whether fares are available for each.

    :param session: SQLAlchemy session object
    :return: The PUV types
    """
    return services.list_transport_types(session)


@router.get("/fare-data/status", response_model=list[schema.FareDataStatusSchema])
def fare_data_status(session: Annotated[Session, Depends(get_db)]):
    """
    Show which fare matrix is in effect for each PUV type, with its source and dates.

    :param session: SQLAlchemy session object
    :return: The fare data status per PUV type
    """
    return services.fare_data_status(session)

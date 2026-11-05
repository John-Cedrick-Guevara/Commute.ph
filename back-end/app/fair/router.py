import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.security import public_rate_limit
from app.fair import schema, services

router = APIRouter(
    prefix="/fair",
    tags=["fair"],
    dependencies=[Depends(public_rate_limit)],
)

@router.get("/routes", response_model=list[schema.RouteMatchSchema], status_code=status.HTTP_200_OK)
def get_routes_between_stops(
    origin_stop_id: uuid.UUID,
    destination_stop_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    puv_type: str = "traditional_jeepney",
):
    """
    Get every route of a PUV type that passes both stops, with the stops from origin to
    destination and the fare.

    :param origin_stop_id: The ID of the starting stop
    :param destination_stop_id: The ID of the destination stop
    :param puv_type: The PUV type code
    :param session: SQLAlchemy session object
    :return: The matching routes, their stops in travel order, distance and fares
    """
    return services.get_routes_between_stops(session, origin_stop_id, destination_stop_id, puv_type)

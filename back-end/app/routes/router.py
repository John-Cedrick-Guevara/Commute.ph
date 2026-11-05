import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.security import require_admin
from app.routes import schema, service

router = APIRouter(
    prefix="/routes",
    tags=["routes"],
    dependencies=[Depends(require_admin)],
)

@router.post("/", response_model=schema.RouteResponseSchema, status_code=status.HTTP_201_CREATED)
def create_route(
    route_data: schema.RouteCreate, session: Annotated[Session, Depends(get_db)]
):
    """
    Create a new route.

    :param route_data: RouteCreate object containing route details
    :param session: SQLAlchemy session object
    :return: The created route object
    """

    new_route = service.create_route(session, route_data)
    return new_route


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_route(
    route_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]
):
    """
    Delete a route by its ID, with its stop list.

    :param route_id: The ID of the route to delete
    :param session: SQLAlchemy session object
    """
    service.delete_route(session, route_id)
    

@router.put("/{route_id}", response_model=schema.RouteResponseSchema, status_code=status.HTTP_200_OK)
def update_route(
    route_id: uuid.UUID,
    route_data: schema.RouteEdit,
    session: Annotated[Session, Depends(get_db)],
):
    """
    Update an existing route by its ID.

    :param route_id: The ID of the route to update
    :param route_data: RouteCreate object containing updated route details
    :param session: SQLAlchemy session object
    :return: The updated route object
    """
    
    return service.update_route(session, route_id, route_data)
   


@router.get("/{route_id}", response_model=schema.RouteDetailSchema)
def get_route(route_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Get a route with its stops in travel order.

    :param route_id: The ID of the route
    :param session: SQLAlchemy session object
    :return: The route and its stops
    """
    return service.get_route_detail(session, route_id)


@router.put("/{route_id}/stops", response_model=schema.RouteDetailSchema)
def set_route_stops(
    route_id: uuid.UUID,
    data: schema.RouteStopsEdit,
    session: Annotated[Session, Depends(get_db)],
):
    """
    Replace a route's stops with an ordered list. Unchanged segments keep their road distance.

    :param route_id: The ID of the route
    :param data: The stop IDs in travel order
    :param session: SQLAlchemy session object
    :return: The route and its stops
    """
    return service.set_route_stops(session, route_id, data.stop_ids)

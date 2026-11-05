import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.security import public_rate_limit, require_admin
from app.stops import schema, service

# Public: the stop list for the picker
router = APIRouter(prefix="/v1/stops", tags=["stops"], dependencies=[Depends(public_rate_limit)])

# Admin: stop management
admin_router = APIRouter(prefix="/v1/admin/stops", tags=["admin: stops"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[schema.StopResponseSchema])
def list_stops(session: Annotated[Session, Depends(get_db)]):
    """
    List every stop, sorted by name.

    :param session: SQLAlchemy session object
    :return: The known stops
    """
    return service.list_stops(session)


@admin_router.post("", response_model=schema.StopResponseSchema, status_code=status.HTTP_201_CREATED)
def create_stop(data: schema.StopCreate, session: Annotated[Session, Depends(get_db)]):
    """
    Create a stop.

    :param data: The stop's name, coordinates and aliases
    :param session: SQLAlchemy session object
    :return: The created stop
    """
    return service.create_stop(session, data)


@admin_router.put("/{stop_id}", response_model=schema.StopResponseSchema)
def update_stop(stop_id: uuid.UUID, data: schema.StopEdit, session: Annotated[Session, Depends(get_db)]):
    """
    Update a stop. Moving it clears the road distances of the route segments around it.

    :param stop_id: The ID of the stop to update
    :param data: The stop's new name, coordinates and aliases
    :param session: SQLAlchemy session object
    :return: The updated stop
    """
    return service.update_stop(session, stop_id, data)


@admin_router.delete("/{stop_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stop(stop_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Delete a stop. Refused (409) while a route still uses it.

    :param stop_id: The ID of the stop to delete
    :param session: SQLAlchemy session object
    """
    service.delete_stop(session, stop_id)

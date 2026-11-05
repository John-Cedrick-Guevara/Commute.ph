import uuid

from pydantic import BaseModel, Field


class RouteMatchStopSchema(BaseModel):
    stop_id: uuid.UUID = Field(..., description="The ID of the stop")
    name: str = Field(..., description="The stop name")
    latitude: float
    longitude: float
    stop_sequence: int = Field(..., description="The stop's position on the route")


class RouteMatchSchema(BaseModel):
    route_id: uuid.UUID = Field(..., description="The ID of the route")
    route_name: str = Field(..., description="The name of the route")
    puv_type: str = Field(..., description="The route's PUV type code")
    stops: list[RouteMatchStopSchema] = Field(
        ..., description="The stops from origin to destination in travel order"
    )
    distance_km: float | None = Field(
        ..., description="The road distance from origin to destination, null if not fetched yet"
    )
    regular_fare: float | None = Field(..., description="The regular fare, null if unavailable")
    discounted_fare: float | None = Field(
        ..., description="The student / senior citizen / PWD fare, null if unavailable"
    )
    fare_matrix_version_id: uuid.UUID | None = Field(
        ..., description="The fare matrix version used, null if the PUV type has none in effect"
    )

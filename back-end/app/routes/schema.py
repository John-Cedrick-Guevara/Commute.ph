import uuid

from pydantic import BaseModel, Field


class RouteSchema(BaseModel):
    route_name: str = Field(..., min_length=1, description="The name of the route")
    puv_type: str = Field(..., description="The PUV type code, e.g. traditional_jeepney")


class RouteResponseSchema(RouteSchema):
    id: uuid.UUID = Field(..., description="The ID of the route")


class RouteCreate(RouteSchema):
    pass


class RouteEdit(RouteSchema):
    pass


class RouteStopsEdit(BaseModel):
    stop_ids: list[uuid.UUID] = Field(..., min_length=2, description="The route's stops in travel order")


class RouteStopResponseSchema(BaseModel):
    stop_id: uuid.UUID
    name: str
    stop_sequence: int
    distance_from_previous_km: float | None


class RouteDetailSchema(RouteResponseSchema):
    stops: list[RouteStopResponseSchema]

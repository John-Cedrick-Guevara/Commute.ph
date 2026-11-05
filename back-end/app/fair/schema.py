import uuid
from datetime import date, datetime

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


class FareMatrixInfoSchema(BaseModel):
    id: uuid.UUID = Field(..., description="The fare matrix version ID")
    effective_from: date = Field(..., description="The date the matrix took effect (Manila time)")
    source_name: str = Field(..., description="Where the fares come from")
    source_url: str | None = Field(None, description="Link to the source, if any")
    verified_at: datetime | None = Field(None, description="When an admin last verified the matrix")


class FareEstimateSchema(BaseModel):
    origin_stop_id: uuid.UUID
    destination_stop_id: uuid.UUID
    puv_type: str = Field(..., description="The PUV type code searched")
    fare_matrix: FareMatrixInfoSchema | None = Field(
        ..., description="The fare matrix in effect, null when the PUV type has none yet"
    )
    routes: list[RouteMatchSchema] = Field(..., description="The routes connecting both stops")


class TransportTypeSchema(BaseModel):
    code: str = Field(..., description="The PUV type code")
    label: str = Field(..., description="The display name")
    has_fare_matrix: bool = Field(..., description="Whether fares are available for this PUV type")


class FareDataStatusSchema(BaseModel):
    puv_type: str
    label: str
    fare_matrix: FareMatrixInfoSchema | None = Field(..., description="The matrix in effect, if any")

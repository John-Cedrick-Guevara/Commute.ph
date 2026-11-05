import uuid

from pydantic import BaseModel, Field


class StopSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="The stop name")
    latitude: float = Field(..., ge=-90, le=90, description="The latitude of the stop")
    longitude: float = Field(..., ge=-180, le=180, description="The longitude of the stop")
    aliases: list[str] = Field(default_factory=list, description="Other names passengers use")


class StopCreate(StopSchema):
    pass


class StopEdit(StopSchema):
    pass


class StopResponseSchema(StopSchema):
    id: uuid.UUID = Field(..., description="The ID of the stop")

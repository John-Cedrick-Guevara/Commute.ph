import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, HttpUrl


class FareRowSchema(BaseModel):
    distance_km: int = Field(..., gt=0, le=500)
    regular_fare: Decimal = Field(..., gt=0, max_digits=6, decimal_places=2)
    discounted_fare: Decimal = Field(..., gt=0, max_digits=6, decimal_places=2)


class DraftCreate(BaseModel):
    puv_type: str = Field(..., description="The PUV type code this matrix is for")


class DraftEdit(BaseModel):
    effective_from: date | None = None
    source_name: str | None = Field(None, max_length=200)
    source_url: HttpUrl | None = None
    rows: list[FareRowSchema] = Field(default_factory=list, max_length=500)


class IssuesSchema(BaseModel):
    errors: list[str] = Field(..., description="Problems that block publishing")
    warnings: list[str] = Field(..., description="Things to double-check; publishing is allowed")


class VersionSummarySchema(BaseModel):
    id: uuid.UUID
    puv_type: str
    status: str
    effective_from: date | None
    source_name: str | None
    source_url: str | None
    source_file_name: str | None
    verified_by: str | None
    verified_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    is_current: bool = Field(..., description="Whether this is the version in effect today")
    row_count: int


class VersionDetailSchema(VersionSummarySchema):
    rows: list[FareRowSchema]
    issues: IssuesSchema
    parse_warnings: list[str] = Field(default_factory=list, description="Notes from reading the uploaded PDF")


class PublishPreviewSchema(BaseModel):
    issues: IssuesSchema
    retiring_saved_fares: int = Field(..., description="Live saved fares that this version will retire")
    retire_on: date | None = Field(..., description="When they retire (the effective date)")
    takes_effect_now: bool


class RetractResultSchema(BaseModel):
    version: VersionSummarySchema
    retired_saved_fares: int
    restored_saved_fares: int

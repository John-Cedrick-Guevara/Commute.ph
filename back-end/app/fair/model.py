import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class PuvType(Base):
    """A kind of PUV with its own fare matrix, e.g. traditional_jeepney."""

    __tablename__ = "puv_types"

    code: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class FareMatrixVersion(Base):
    """
    One fare matrix for a PUV type. Published versions are never edited; a fare change publishes
    a new version. Status: draft (never used for fares), published, or retracted.
    """

    __tablename__ = "fare_matrix_versions"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    puv_type: Mapped[str] = mapped_column(String, ForeignKey("puv_types.code"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    effective_from: Mapped[date | None] = mapped_column(Date)

    source_name: Mapped[str | None] = mapped_column(String)
    source_url: Mapped[str | None] = mapped_column(String)
    source_file: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    source_file_name: Mapped[str | None] = mapped_column(String)

    verified_by: Mapped[str | None] = mapped_column(String)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class FareMatrixRow(Base):
    __tablename__ = "fare_matrix_rows"

    version_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("fare_matrix_versions.id"), primary_key=True
    )
    distance_km: Mapped[int] = mapped_column(Integer, primary_key=True)

    regular_fare: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    # Student / senior citizen / PWD fare
    discounted_fare: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)


class SavedFare(Base):
    """
    A fare search result for a stop pair and PUV type, computed with one fare matrix version.
    deleted_at set = soft-deleted: no longer served, kept 15 days for a matrix rollback.
    """

    __tablename__ = "saved_fares"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # References stops.id / puv_types.code / fare_matrix_versions.id (enforced by the database)
    origin_stop_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    destination_stop_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    puv_type: Mapped[str] = mapped_column(String, nullable=False)
    fare_matrix_version_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)

    routes: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime)

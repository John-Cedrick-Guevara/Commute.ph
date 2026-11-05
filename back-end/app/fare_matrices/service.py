import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.fair.model import FareMatrixRow, FareMatrixVersion, PuvType, SavedFare
from app.fair.services import current_version_id
from app.fare_matrices import schema
from app.fare_matrices.parser import parse_fare_pdf
from app.security import Admin

MAX_PDF_BYTES = 10 * 1024 * 1024


# ---------------------------------------------------------------- Reads

def manila_today(db: Session) -> date:
    return db.execute(text("select (now() at time zone 'Asia/Manila')::date")).scalar()


def get_version(db: Session, version_id: uuid.UUID) -> FareMatrixVersion:
    version = db.get(FareMatrixVersion, version_id)
    if version is None:
        raise HTTPException(status_code=404, detail=f"Fare matrix {version_id} not found")
    return version


def get_rows(db: Session, version_id: uuid.UUID) -> list[FareMatrixRow]:
    return list(db.execute(
        select(FareMatrixRow).where(FareMatrixRow.version_id == version_id).order_by(FareMatrixRow.distance_km)
    ).scalars())


def summary(db: Session, version: FareMatrixVersion, row_count: int | None = None) -> dict:
    if row_count is None:
        row_count = db.execute(
            select(func.count()).select_from(FareMatrixRow).where(FareMatrixRow.version_id == version.id)
        ).scalar()
    return {
        "id": version.id, "puv_type": version.puv_type, "status": version.status,
        "effective_from": version.effective_from, "source_name": version.source_name,
        "source_url": version.source_url, "source_file_name": version.source_file_name,
        "verified_by": version.verified_by, "verified_at": version.verified_at,
        "published_at": version.published_at, "created_at": version.created_at,
        "is_current": current_version_id(db, version.puv_type) == version.id,
        "row_count": row_count,
    }


def detail(db: Session, version: FareMatrixVersion, parse_warnings: list[str] | None = None) -> dict:
    rows = get_rows(db, version.id)
    return {
        **summary(db, version, len(rows)),
        "rows": rows,
        "issues": check(version, rows),
        "parse_warnings": parse_warnings or [],
    }


def list_versions(db: Session) -> list[dict]:
    counts = dict(db.execute(
        select(FareMatrixRow.version_id, func.count()).group_by(FareMatrixRow.version_id)
    ).all())
    versions = db.execute(
        select(FareMatrixVersion).order_by(
            FareMatrixVersion.puv_type, FareMatrixVersion.effective_from.desc().nulls_first(),
            FareMatrixVersion.created_at.desc(),
        )
    ).scalars()
    return [summary(db, v, counts.get(v.id, 0)) for v in versions]


# ---------------------------------------------------------------- Validation

def check(version: FareMatrixVersion, rows: list) -> dict:
    """
    Check a matrix before publishing. Errors block publishing; warnings ask the admin to
    double-check (e.g. a discount that isn't the usual 20%).
    """
    errors: list[str] = []
    warnings: list[str] = []

    if version.effective_from is None:
        errors.append("Set the effective date.")
    if not version.source_name:
        errors.append("Name the source (e.g. the LTFRB memorandum circular).")
    if not rows:
        errors.append("Add at least one fare row.")
        return {"errors": errors, "warnings": warnings}

    kms = [r.distance_km for r in rows]
    if kms[0] != 1:
        errors.append(f"The matrix must start at 1 km (it starts at {kms[0]} km).")
    gaps = [km for prev, km in zip(kms, kms[1:]) if km != prev + 1]
    if gaps:
        errors.append(f"Missing distances before: {', '.join(f'{km} km' for km in gaps)}.")

    for row in rows:
        # 20% off, usually rounded to the nearest 25 centavos
        if abs(row.discounted_fare - row.regular_fare * Decimal("0.8")) > Decimal("0.50"):
            warnings.append(f"{row.distance_km} km: the discount isn't about 20% "
                            f"(₱{row.regular_fare} regular, ₱{row.discounted_fare} discounted).")

    for prev, row in zip(rows, rows[1:]):
        if row.regular_fare < prev.regular_fare:
            errors.append(f"{row.distance_km} km: the regular fare is lower than at {prev.distance_km} km.")
        if row.discounted_fare < prev.discounted_fare:
            errors.append(f"{row.distance_km} km: the discounted fare is lower than at {prev.distance_km} km.")

    return {"errors": errors, "warnings": warnings}


# ---------------------------------------------------------------- Drafts

def require_draft(version: FareMatrixVersion) -> None:
    if version.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Published fare matrices can't be edited. Create a new draft to change fares.",
        )


def commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


def create_draft(db: Session, data: schema.DraftCreate) -> dict:
    if db.get(PuvType, data.puv_type) is None:
        raise HTTPException(status_code=422, detail=f"Unknown PUV type {data.puv_type!r}")
    version = FareMatrixVersion(puv_type=data.puv_type, status="draft")
    db.add(version)
    commit(db)
    return detail(db, version)


def replace_rows(db: Session, version_id: uuid.UUID, rows: list[dict]) -> None:
    db.execute(delete(FareMatrixRow).where(FareMatrixRow.version_id == version_id))
    db.add_all(FareMatrixRow(version_id=version_id, **row) for row in rows)


def update_draft(db: Session, version_id: uuid.UUID, data: schema.DraftEdit) -> dict:
    version = get_version(db, version_id)
    require_draft(version)

    kms = [r.distance_km for r in data.rows]
    if len(kms) != len(set(kms)):
        raise HTTPException(status_code=422, detail="Each distance can appear only once.")
    # The database never stores a discount above the regular fare
    inverted = [r.distance_km for r in data.rows if r.discounted_fare > r.regular_fare]
    if inverted:
        raise HTTPException(
            status_code=422,
            detail=f"The discounted fare is higher than the regular fare at: {', '.join(f'{km} km' for km in inverted)}.",
        )

    version.effective_from = data.effective_from
    version.source_name = data.source_name.strip() if data.source_name else None
    version.source_url = str(data.source_url) if data.source_url else None
    replace_rows(db, version.id, [r.model_dump() for r in data.rows])
    commit(db)
    return detail(db, version)


def upload_source(db: Session, version_id: uuid.UUID, file_name: str, data: bytes) -> dict:
    """
    Attach the fare matrix PDF to a draft and fill the draft's rows from it.
    The rows replace the draft's current rows; the admin reviews them before publishing.
    """
    version = get_version(db, version_id)
    require_draft(version)
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="The PDF is larger than 10 MB.")
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="The file isn't a PDF.")

    rows, warnings = parse_fare_pdf(data)
    # Discount above the regular fare usually means the PDF's columns are the other way round
    inverted = [r for r in rows if r["discounted_fare"] > r["regular_fare"]]
    if inverted:
        rows = [r for r in rows if r not in inverted]
        warnings.append(
            "Skipped rows where the discounted fare is higher than the regular fare (check the PDF's "
            f"column order): {', '.join(str(r['distance_km']) + ' km' for r in inverted)}."
        )
    version.source_file = data
    version.source_file_name = file_name
    if rows:
        replace_rows(db, version.id, rows)
    commit(db)
    return detail(db, version, warnings)


def delete_draft(db: Session, version_id: uuid.UUID) -> None:
    version = get_version(db, version_id)
    require_draft(version)
    db.delete(version)
    commit(db)


# ---------------------------------------------------------------- Publish / retract

def live_saved_fares(db: Session, puv_type: str) -> int:
    return db.execute(
        select(func.count()).select_from(SavedFare)
        .where(SavedFare.puv_type == puv_type, SavedFare.deleted_at.is_(None))
    ).scalar()


def publish_preview(db: Session, version_id: uuid.UUID) -> dict:
    """What publishing would do: blocking issues, and how many saved fares it retires and when."""
    version = get_version(db, version_id)
    require_draft(version)
    today = manila_today(db)
    effective = version.effective_from
    return {
        "issues": check(version, get_rows(db, version.id)),
        # Every live saved fare of this PUV type was computed with the version in effect,
        # which this one replaces once it takes effect
        "retiring_saved_fares": live_saved_fares(db, version.puv_type),
        "retire_on": effective,
        "takes_effect_now": effective is not None and effective <= today,
    }


def publish(db: Session, version_id: uuid.UUID, admin: Admin) -> dict:
    version = get_version(db, version_id)
    require_draft(version)
    issues = check(version, get_rows(db, version.id))
    if issues["errors"]:
        raise HTTPException(status_code=422, detail=" ".join(issues["errors"]))

    now = datetime.now()
    version.status = "published"
    version.published_at = now
    version.verified_by = admin.email
    version.verified_at = now
    db.flush()
    # Takes effect today or earlier: retire the old saved fares now instead of at the nightly job
    db.execute(select(func.retire_saved_fares()))
    commit(db)
    return detail(db, version)


def retract(db: Session, version_id: uuid.UUID) -> dict:
    """
    Withdraw a published matrix (e.g. entered wrong). The previous version applies again, saved
    fares computed with this one are retired, and the previous version's saved fares soft-deleted
    in the last 15 days are restored.
    """
    version = get_version(db, version_id)
    if version.status != "published":
        raise HTTPException(status_code=409, detail="Only a published fare matrix can be retracted.")

    version.status = "retracted"
    db.flush()
    retired = db.execute(select(func.retire_saved_fares())).scalar()
    restored = db.execute(
        text("""
            update saved_fares s set deleted_at = null
            where s.id in (
                select distinct on (origin_stop_id, destination_stop_id) id
                from saved_fares
                where puv_type = :puv_type
                  and fare_matrix_version_id = current_fare_matrix_version(:puv_type)
                  and deleted_at > now() - interval '15 days'
                order by origin_stop_id, destination_stop_id, deleted_at desc
            )
            and not exists (
                select 1 from saved_fares live
                where live.deleted_at is null
                  and live.origin_stop_id = s.origin_stop_id
                  and live.destination_stop_id = s.destination_stop_id
                  and live.puv_type = s.puv_type
            )
        """),
        {"puv_type": version.puv_type},
    ).rowcount
    commit(db)
    return {"version": summary(db, version), "retired_saved_fares": retired, "restored_saved_fares": restored}


def source_file(db: Session, version_id: uuid.UUID) -> tuple[str, bytes]:
    version = get_version(db, version_id)
    if version.source_file is None:
        raise HTTPException(status_code=404, detail="This fare matrix has no uploaded PDF.")
    return version.source_file_name or "fare-matrix.pdf", version.source_file

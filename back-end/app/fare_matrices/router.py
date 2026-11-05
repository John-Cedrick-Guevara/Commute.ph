import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.fare_matrices import schema, service
from app.security import Admin, require_admin

router = APIRouter(
    prefix="/v1/admin/fare-matrices",
    tags=["admin: fare matrices"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[schema.VersionSummarySchema])
def list_versions(session: Annotated[Session, Depends(get_db)]):
    """
    List every fare matrix version, grouped by PUV type, newest first.

    :param session: SQLAlchemy session object
    :return: The versions with their status and whether each is in effect
    """
    return service.list_versions(session)


@router.post("", response_model=schema.VersionDetailSchema, status_code=status.HTTP_201_CREATED)
def create_draft(data: schema.DraftCreate, session: Annotated[Session, Depends(get_db)]):
    """
    Start a draft fare matrix for a PUV type. Drafts are never used for fares.

    :param data: The PUV type
    :param session: SQLAlchemy session object
    :return: The empty draft
    """
    return service.create_draft(session, data)


@router.get("/{version_id}", response_model=schema.VersionDetailSchema)
def get_version(version_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Get a fare matrix version with its rows and validation issues.

    :param version_id: The version ID
    :param session: SQLAlchemy session object
    :return: The version, rows and issues
    """
    return service.detail(session, service.get_version(session, version_id))


@router.put("/{version_id}", response_model=schema.VersionDetailSchema)
def update_draft(version_id: uuid.UUID, data: schema.DraftEdit, session: Annotated[Session, Depends(get_db)]):
    """
    Save a draft's effective date, source and rows (the rows replace the current ones).

    :param version_id: The draft ID
    :param data: The draft's fields and rows
    :param session: SQLAlchemy session object
    :return: The draft with its validation issues
    """
    return service.update_draft(session, version_id, data)


@router.delete("/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(version_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Delete a draft. Published versions are kept for history.

    :param version_id: The draft ID
    :param session: SQLAlchemy session object
    """
    service.delete_draft(session, version_id)


@router.post("/{version_id}/source", response_model=schema.VersionDetailSchema)
async def upload_source(
    version_id: uuid.UUID,
    file: Annotated[UploadFile, File(description="The fare matrix PDF")],
    session: Annotated[Session, Depends(get_db)],
):
    """
    Attach the fare matrix PDF to a draft and fill its rows from the PDF for review.

    :param version_id: The draft ID
    :param file: The PDF
    :param session: SQLAlchemy session object
    :return: The draft with the parsed rows, issues and notes from reading the PDF
    """
    # Read one byte past the limit so an oversized file is rejected without loading all of it
    data = await file.read(service.MAX_PDF_BYTES + 1)
    return service.upload_source(session, version_id, file.filename or "fare-matrix.pdf", data)


@router.get("/{version_id}/source")
def download_source(version_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Download the PDF a fare matrix was entered from.

    :param version_id: The version ID
    :param session: SQLAlchemy session object
    :return: The PDF file
    """
    name, data = service.source_file(session, version_id)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}"},
    )


@router.get("/{version_id}/publish-preview", response_model=schema.PublishPreviewSchema)
def publish_preview(version_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Show what publishing a draft would do: blocking issues and the saved fares it retires.

    :param version_id: The draft ID
    :param session: SQLAlchemy session object
    :return: Issues, the number of saved fares to retire and when
    """
    return service.publish_preview(session, version_id)


@router.post("/{version_id}/publish", response_model=schema.VersionDetailSchema)
def publish(
    version_id: uuid.UUID,
    session: Annotated[Session, Depends(get_db)],
    admin: Annotated[Admin, Depends(require_admin)],
):
    """
    Publish a draft. It takes effect on its effective date and is never edited afterwards.

    :param version_id: The draft ID
    :param session: SQLAlchemy session object
    :param admin: The signed-in admin, recorded as the verifier
    :return: The published version
    """
    return service.publish(session, version_id, admin)


@router.post("/{version_id}/retract", response_model=schema.RetractResultSchema)
def retract(version_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]):
    """
    Withdraw a published version; the previous version applies again and its recent saved fares
    are restored.

    :param version_id: The version ID
    :param session: SQLAlchemy session object
    :return: The retracted version and how many saved fares were retired and restored
    """
    return service.retract(session, version_id)

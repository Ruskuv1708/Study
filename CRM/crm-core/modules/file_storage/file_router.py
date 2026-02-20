from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from core.database_connector import get_db
from core.config import settings
from core.workspace_resolver import resolve_workspace_id
from modules.access_control.access_security import get_current_user
from modules.access_control.access_permissions import PermissionService
from modules.file_storage.file_service import FileStorageService

router = APIRouter(prefix="/files", tags=["File Storage"])


def _serialize_file(file_record):
    return {
        "id": str(file_record.id),
        "filename": file_record.filename,
        "content_type": file_record.content_type,
        "file_size": file_record.file_size,
        "uploaded_by_id": str(file_record.uploaded_by_id) if file_record.uploaded_by_id else None,
        "workspace_id": str(file_record.workspace_id) if file_record.workspace_id else None,
        "entity_id": str(file_record.entity_id) if file_record.entity_id else None,
        "entity_type": file_record.entity_type,
        "created_at": file_record.created_at.isoformat() if file_record.created_at else None,
    }


@router.get("")
def list_documents(
    entity_type: Optional[str] = None,
    entity_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List file metadata in the current workspace."""
    normalized_entity_type = entity_type.strip().lower() if entity_type else None
    if normalized_entity_type == "report":
        PermissionService.require_permission(current_user, "view_reports")
    else:
        PermissionService.require_permission(current_user, "download_files")

    workspace_id = resolve_workspace_id(current_user, workspace_id)
    files = FileStorageService.list_files(
        db,
        workspace_id,
        current_user=current_user,
        entity_type=normalized_entity_type,
        entity_id=entity_id,
        skip=skip,
        limit=limit,
    )
    return [_serialize_file(item) for item in files]

@router.post("/upload")
def upload_document(
    file: UploadFile = File(...),
    entity_id: Optional[UUID] = Form(None), # e.g., Request ID
    entity_type: Optional[str] = Form(None), # e.g., "request"
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Upload a file and attach it to something """
    PermissionService.require_permission(current_user, "upload_files")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return FileStorageService.save_file(
        db,
        file,
        current_user.id,
        workspace_id,
        entity_id,
        entity_type,
        current_user=current_user,
    )

@router.get("/download/{file_id}")
def download_document(
    file_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Secure Download """
    PermissionService.require_permission(current_user, "download_files")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    
    # 1. Get Metadata
    file_record = FileStorageService.get_file_for_download(
        db,
        file_id,
        workspace_id,
        current_user=current_user,
    )
    
    # 2. Stream the file back
    # 'media_type' tells the browser if it's a PDF, Image, etc.
    # 'filename' tells the browser what name to save it as.
    return FileResponse(
        path=file_record.physical_path,
        media_type=file_record.content_type,
        filename=file_record.filename
    )


@router.delete("/{file_id}")
def delete_document(
    file_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Delete a file attachment """
    PermissionService.require_permission(current_user, "delete_files")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return FileStorageService.delete_file(db, file_id, workspace_id, current_user=current_user)
    

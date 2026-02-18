from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from core.database_connector import get_db
from core.workspace_resolver import resolve_workspace_id
from modules.access_control.access_security import get_current_user
from modules.access_control.access_permissions import PermissionService
from modules.file_storage.file_service import FileStorageService

router = APIRouter(prefix="/files", tags=["File Storage"])

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
    

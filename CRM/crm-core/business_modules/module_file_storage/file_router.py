from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from system_core.database_connector import get_db
from system_core.context import get_current_workspace_id
from business_modules.module_access_control.access_security import get_current_user
from business_modules.module_file_storage.file_service import FileStorageService

router = APIRouter(prefix="/files", tags=["File Storage"])

@router.post("/upload")
def upload_document(
    file: UploadFile = File(...),
    entity_id: Optional[UUID] = Form(None), # e.g., Request ID
    entity_type: Optional[str] = Form(None), # e.g., "request"
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Upload a file and attach it to something """
    workspace_id = get_current_workspace_id()
    return FileStorageService.save_file(
        db, file, current_user.id, workspace_id, entity_id, entity_type
    )

@router.get("/download/{file_id}")
def download_document(
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Secure Download """
    workspace_id = get_current_workspace_id()
    
    # 1. Get Metadata
    file_record = FileStorageService.get_file_for_download(db, file_id, workspace_id)
    
    # 2. Stream the file back
    # 'media_type' tells the browser if it's a PDF, Image, etc.
    # 'filename' tells the browser what name to save it as.
    return FileResponse(
        path=file_record.physical_path,
        media_type=file_record.content_type,
        filename=file_record.filename
    )
    
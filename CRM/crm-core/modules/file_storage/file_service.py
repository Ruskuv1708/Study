import os
import shlex
import shutil
import subprocess
import uuid
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from modules.access_control.access_enums import UserRole
from modules.file_storage.file_models import FileAttachment

# CONFIG: Where do we save?
STORAGE_ROOT = settings.FILE_STORAGE_ROOT
MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_MIME_TYPES = None
if settings.ALLOWED_UPLOAD_MIME:
    ALLOWED_MIME_TYPES = {m.strip().lower() for m in settings.ALLOWED_UPLOAD_MIME.split(",") if m.strip()}

class FileStorageService:

    @staticmethod
    def save_file(db: Session, upload_file: UploadFile, user_id, workspace_id, entity_id=None, entity_type=None, current_user=None):
        # 1. Create workspace Directory (Isolation)
        # Structure: media_storage/{workspace_id}/
        workspace_path = os.path.join(STORAGE_ROOT, str(workspace_id))
        os.makedirs(workspace_path, exist_ok=True)

        normalized_entity_type = FileStorageService._normalize_entity_type(entity_type)
        FileStorageService._validate_entity_access(db, normalized_entity_type, entity_id, workspace_id, current_user)

        # Validate content type when configured
        if ALLOWED_MIME_TYPES:
            content_type = (upload_file.content_type or "").lower()
            if content_type not in ALLOWED_MIME_TYPES:
                raise HTTPException(status_code=415, detail="Unsupported file type")

        # 2. Generate Safe Name
        # We rename "hack.exe" to "a1b2-c3d4..." to be safe.
        safe_filename = str(uuid.uuid4())
        physical_path = os.path.join(workspace_path, safe_filename)

        # 3. Write to Disk
        try:
            with open(physical_path, "wb") as buffer:
                # Shutil creates a stream to copy data efficiently
                shutil.copyfileobj(upload_file.file, buffer)
        except Exception as e:
            raise HTTPException(500, detail=f"File write failed: {e}")

        # 4. Validate and Save Metadata to DB
        # We need the cursor at the end to know the size, or read from headers
        # FastAPI spools files, so getting size can be tricky.
        # Simple way: use os.path.getsize after saving.
        file_size = os.path.getsize(physical_path)
        if file_size > MAX_UPLOAD_BYTES:
            try:
                os.remove(physical_path)
            except OSError:
                pass
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds max size of {settings.MAX_UPLOAD_MB} MB"
            )

        # Optional antivirus scan hook
        if settings.FILE_SCAN_COMMAND:
            try:
                cmd = shlex.split(settings.FILE_SCAN_COMMAND) + [physical_path]
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=settings.FILE_SCAN_TIMEOUT_SECONDS,
                    check=False,
                )
            except Exception:
                try:
                    os.remove(physical_path)
                except OSError:
                    pass
                raise HTTPException(status_code=500, detail="File scan failed")
            if result.returncode != 0:
                try:
                    os.remove(physical_path)
                except OSError:
                    pass
                raise HTTPException(status_code=400, detail="File rejected by security scan")

        db_file = FileAttachment(
            filename=upload_file.filename,
            content_type=upload_file.content_type,
            file_size=file_size,
            physical_path=physical_path,
            uploaded_by_id=user_id,
            workspace_id=workspace_id,
            entity_id=entity_id,
            entity_type=normalized_entity_type
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        return db_file

    @staticmethod
    def get_file_for_download(db: Session, file_id, workspace_id, current_user=None):
        # 1. Find the Record
        file_record = db.query(FileAttachment).filter(
            FileAttachment.id == file_id,
            FileAttachment.workspace_id == workspace_id
        ).first()

        if not file_record:
            raise HTTPException(404, detail="File not found")

        normalized_entity_type = FileStorageService._normalize_entity_type(file_record.entity_type)
        FileStorageService._validate_entity_access(
            db,
            normalized_entity_type,
            file_record.entity_id,
            workspace_id,
            current_user,
        )
        if normalized_entity_type is None and current_user is not None:
            if current_user.role not in (
                UserRole.SUPERADMIN,
                UserRole.SYSTEM_ADMIN,
                UserRole.ADMIN,
            ) and file_record.uploaded_by_id != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")

        # 2. Check if file exists on disk
        if not os.path.exists(file_record.physical_path):
            raise HTTPException(500, detail="File missing from disk")

        return file_record

    @staticmethod
    def delete_file(db: Session, file_id, workspace_id, current_user=None):
        file_record = db.query(FileAttachment).filter(
            FileAttachment.id == file_id,
            FileAttachment.workspace_id == workspace_id
        ).first()
        if not file_record:
            raise HTTPException(404, detail="File not found")

        normalized_entity_type = FileStorageService._normalize_entity_type(file_record.entity_type)
        FileStorageService._validate_entity_access(
            db,
            normalized_entity_type,
            file_record.entity_id,
            workspace_id,
            current_user,
        )
        if normalized_entity_type is None and current_user is not None:
            if current_user.role not in (
                UserRole.SUPERADMIN,
                UserRole.SYSTEM_ADMIN,
                UserRole.ADMIN,
            ) and file_record.uploaded_by_id != current_user.id:
                raise HTTPException(status_code=403, detail="Access denied")

        physical_path = file_record.physical_path
        db.delete(file_record)
        db.commit()

        try:
            if physical_path and os.path.exists(physical_path):
                os.remove(physical_path)
        except OSError:
            # Best-effort cleanup; orphaned file can be cleaned later
            pass

        return {"message": "File deleted"}

    @staticmethod
    def delete_files_for_entity(db: Session, workspace_id, entity_type: str, entity_id) -> int:
        """
        Best-effort cleanup of attachments tied to an entity (no commit).
        Caller is responsible for committing the transaction.
        """
        normalized_entity_type = FileStorageService._normalize_entity_type(entity_type)
        if not normalized_entity_type or not entity_id:
            return 0

        query = db.query(FileAttachment).filter(
            FileAttachment.entity_type == normalized_entity_type,
            FileAttachment.entity_id == entity_id,
        )
        if workspace_id:
            query = query.filter(FileAttachment.workspace_id == workspace_id)

        files = query.all()
        for file_record in files:
            physical_path = file_record.physical_path
            db.delete(file_record)
            try:
                if physical_path and os.path.exists(physical_path):
                    os.remove(physical_path)
            except OSError:
                # Best-effort cleanup; orphaned file can be cleaned later
                pass
        return len(files)

    @staticmethod
    def _normalize_entity_type(entity_type: str | None) -> str | None:
        if not entity_type:
            return None
        return str(entity_type).strip().lower()

    @staticmethod
    def _validate_entity_access(db: Session, entity_type: str | None, entity_id, workspace_id, current_user):
        if not entity_type:
            if current_user is None:
                raise HTTPException(status_code=403, detail="Access denied")
            # Non-entity files are restricted to uploader or admins
            if hasattr(current_user, "role") and current_user.role in (
                UserRole.SUPERADMIN,
                UserRole.SYSTEM_ADMIN,
                UserRole.ADMIN,
            ):
                return
            # If current_user doesn't have uploader context here, leave enforcement
            return
        if not entity_id:
            raise HTTPException(status_code=400, detail="entity_id is required when entity_type is provided")
        if entity_type == "request":
            if current_user is None:
                raise HTTPException(status_code=403, detail="Access denied")
            from modules.workflow.workflow_service import WorkflowService
            WorkflowService.get_request_by_id(db, entity_id, workspace_id, current_user)
            return
        raise HTTPException(status_code=400, detail="Unsupported entity_type")

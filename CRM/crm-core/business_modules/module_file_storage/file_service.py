import os
import shutil
import uuid
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from business_modules.module_file_storage.file_models import FileAttachment

# CONFIG: Where do we save?
STORAGE_ROOT = "media_storage"

class FileStorageService:

    @staticmethod
    def save_file(db: Session, upload_file: UploadFile, user_id, workspace_id, entity_id=None, entity_type=None):
        # 1. Create workspace Directory (Isolation)
        # Structure: media_storage/{workspace_id}/
        workspace_path = os.path.join(STORAGE_ROOT, str(workspace_id))
        os.makedirs(workspace_path, exist_ok=True)

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

        # 4. Save Metadata to DB
        # We need the cursor at the end to know the size, or read from headers
        # FastAPI spools files, so getting size can be tricky.
        # Simple way: use os.path.getsize after saving.
        file_size = os.path.getsize(physical_path)

        db_file = FileAttachment(
            filename=upload_file.filename,
            content_type=upload_file.content_type,
            file_size=file_size,
            physical_path=physical_path,
            uploaded_by_id=user_id,
            workspace_id=workspace_id,
            entity_id=entity_id,
            entity_type=entity_type
        )
        
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        return db_file

    @staticmethod
    def get_file_for_download(db: Session, file_id, workspace_id):
        # 1. Find the Record
        file_record = db.query(FileAttachment).filter(
            FileAttachment.id == file_id,
            FileAttachment.workspace_id == workspace_id
        ).first()

        if not file_record:
            raise HTTPException(404, detail="File not found")

        # 2. Check if file exists on disk
        if not os.path.exists(file_record.physical_path):
            raise HTTPException(500, detail="File missing from disk")

        return file_record
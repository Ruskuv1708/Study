from sqlalchemy import Column, String, Integer, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from core.base_models import CRMBasedModel

class FileAttachment(CRMBasedModel):
    __tablename__ = "storage_files"
    __table_args__ = (
        Index("ix_storage_files_workspace_entity", "workspace_id", "entity_type", "entity_id"),
        Index("ix_storage_files_workspace_uploaded_by", "workspace_id", "uploaded_by_id"),
        Index("ix_storage_files_workspace_created_at", "workspace_id", "created_at"),
    )

    # 1. Human Info
    filename = Column(String, nullable=False)   # e.g., "contract.pdf"
    content_type = Column(String, nullable=False) # e.g., "application/pdf"
    file_size = Column(Integer, nullable=False)   # in bytes

    # 2. System Info (Security)
    # We NEVER save the file as "contract.pdf" on disk. We save it as a UUID.
    # This prevents hackers from overwriting system files.
    physical_path = Column(String, nullable=False, unique=True)

    # 3. Ownership
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    # 4. Context (What does this belong to?)
    # Optional: Link to a Request or User Profile.
    # For now, we keep it generic.
    entity_id = Column(UUID(as_uuid=True), nullable=True) # e.g. Request ID
    entity_type = Column(String, nullable=True) # e.g. "request", "user_avatar"
    

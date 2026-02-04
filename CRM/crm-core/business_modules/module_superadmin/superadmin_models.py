from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel
from datetime import datetime
from business_modules.module_superadmin.superadmin_enums import WorkspaceStatus

class Workspace(CRMBasedModel):
    """
    Isolated Workspace (Organization) - Only Superadmin manages this
    """
    __tablename__ = "access_workspaces"

    # Identity
    name = Column(String, nullable=False)                    # e.g., "Acme Corp"
    subdomain_prefix = Column(String, unique=True, index=True, nullable=False)  # e.g., "acme"
    
    # Admin Contact
    admin_email = Column(String, nullable=False)
    admin_full_name = Column(String, nullable=False)
    
    # Status & Metadata
    status = Column(String, default=WorkspaceStatus.ACTIVE, nullable=False)
    
    # Workspace Settings
    settings = Column(JSON, default={})  # {features_enabled, plan_type, etc}
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime, nullable=True)
    suspended_at = Column(DateTime, nullable=True)
    
    # Status Toggle
    is_active = Column(Boolean, default=True)

    # Relationship to Users (from access_control module)
    # We import this dynamically to avoid circular imports
    # users = relationship("User", back_populates="workspace")clea
    class Config:
        orm_mode = True
        
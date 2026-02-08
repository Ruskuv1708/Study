from sqlalchemy import Column, String, Boolean, ForeignKey, Enum,DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel
from business_modules.module_access_control.access_enums import UserRole
from datetime import datetime
from business_modules.module_access_control.access_enums import WorkspaceStatus
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
    users = relationship("User", back_populates="workspace")
    class Config:
        orm_mode = True
        

class User(CRMBasedModel):
    __tablename__ = "access_users"

    # 1. Login Info
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # 2. Real Name
    full_name = Column(String, nullable=False)

    # 3. Roles
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)



    # 4. Link to Workspace (Renamed from tenant_id)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)
    
    # Relationship
    workspace = relationship("Workspace", back_populates="users")

    class Config:
        orm_mode = True

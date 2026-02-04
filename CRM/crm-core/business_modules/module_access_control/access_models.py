from sqlalchemy import Column, String, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel
from business_modules.module_access_control.access_enums import UserRole
from business_modules.module_superadmin.superadmin_models import Workspace



class User(CRMBasedModel):
    """
    User with role-based access control
    """
    __tablename__ = "access_users"

    # 1. Login Info
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # 2. Real Name
    full_name = Column(String, nullable=False)

    # 3. Roles (Simplified for now)
    # We will expand this into a full Permission System later.
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)

    # 4. Multi-Tenancy Link
    # This user belongs to ONE company.
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)
    
    # Relationship
    workspace = relationship("Workspace", back_populates="users")
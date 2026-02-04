from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel

class Notification(CRMBasedModel):
    __tablename__ = "system_notifications"

    # 1. Who is this for?
    user_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=False)
    
    # 2. The Content
    title = Column(String, nullable=False)   # e.g., "New Task"
    message = Column(String, nullable=False) # e.g., "Bob assigned Request #123 to you"
    
    # 3. The Action Link (Frontend route)
    # e.g., "/requests/view/a1b2-c3d4"
    target_link = Column(String, nullable=True) 

    # 4. Status
    is_read = Column(Boolean, default=False)
    
    # 5. Multi-Tenancy (Strict Data Isolation)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    # Relationship
    recipient = relationship("User", foreign_keys=[user_id])
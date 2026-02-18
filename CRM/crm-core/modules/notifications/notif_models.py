from sqlalchemy import Column, String, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from core.base_models import CRMBasedModel

class Notification(CRMBasedModel):
    __tablename__ = "system_notifications"
    __table_args__ = (
        Index("ix_system_notifications_user_read", "user_id", "is_read"),
        Index("ix_system_notifications_workspace_id", "workspace_id"),
    )

    user_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    target_link = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    
    # CHANGE: access_tenants -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    recipient = relationship("User", foreign_keys=[user_id])

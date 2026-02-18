from sqlalchemy import Column, String, ForeignKey, Enum, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from core.base_models import CRMBasedModel
from modules.workflow.workflow_enums import RequestStatus, RequestPriority

class Department(CRMBasedModel):
    __tablename__ = "workflow_departments"
    __table_args__ = (
        Index("ix_workflow_departments_workspace_id", "workspace_id"),
    )

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # CHANGE: access_workspace -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    requests = relationship("Request", back_populates="department")
    users = relationship("User", back_populates="department")


class Request(CRMBasedModel):
    __tablename__ = "workflow_requests"
    __table_args__ = (
        Index("ix_workflow_requests_workspace_created_at", "workspace_id", "created_at"),
        Index("ix_workflow_requests_workspace_status_created_at", "workspace_id", "status", "created_at"),
        Index("ix_workflow_requests_workspace_department_id", "workspace_id", "department_id"),
        Index("ix_workflow_requests_workspace_assigned_to_id", "workspace_id", "assigned_to_id"),
        Index("ix_workflow_requests_workspace_created_by_id", "workspace_id", "created_by_id"),
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(RequestStatus), default=RequestStatus.NEW, nullable=False)
    priority = Column(Enum(RequestPriority), default=RequestPriority.MEDIUM, nullable=False)

    department_id = Column(UUID(as_uuid=True), ForeignKey("workflow_departments.id"), nullable=False)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=True)
    
    # CHANGE: access_tenants -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    department = relationship("Department", back_populates="requests")
    assignee = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

from sqlalchemy import Column, String, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel
from business_modules.module_workflow.workflow_enums import RequestStatus, RequestPriority

class Department(CRMBasedModel):
    __tablename__ = "workflow_departments"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # CHANGE: access_workspace -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    requests = relationship("Request", back_populates="department")


class Request(CRMBasedModel):
    __tablename__ = "workflow_requests"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(RequestStatus), default=RequestStatus.NEW, nullable=False)
    priority = Column(Enum(RequestPriority), default=RequestPriority.MEDIUM, nullable=False)

    department_id = Column(UUID(as_uuid=True), ForeignKey("workflow_departments.id"), nullable=False)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=True)
    
    # CHANGE: access_tenants -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    department = relationship("Department", back_populates="requests")
    assignee = relationship("User", foreign_keys=[assigned_to_id])
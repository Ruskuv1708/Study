from sqlalchemy import Column, String, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from system_core.base_models import CRMBasedModel
from business_modules.module_workflow.workflow_enums import RequestStatus, RequestPriority

class Department(CRMBasedModel):
    """
    Represents a functional unit (e.g., 'IT Support', 'HR Onboarding').
    """
    __tablename__ = "workflow_departments"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # Isolation: Departments belong to a specific Company
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    # Relationship to Requests
    requests = relationship("Request", back_populates="department")


class Request(CRMBasedModel):
    """
    A generic work item (Ticket, Task, Application).
    """
    __tablename__ = "workflow_requests"

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # 1. State Machine
    status = Column(Enum(RequestStatus), default=RequestStatus.NEW, nullable=False)
    priority = Column(Enum(RequestPriority), default=RequestPriority.MEDIUM, nullable=False)

    # 2. Routing (Where does this go?)
    department_id = Column(UUID(as_uuid=True), ForeignKey("workflow_departments.id"), nullable=False)
    
    # 3. Ownership (Who is doing it?)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("access_users.id"), nullable=True)
    
    # 4. Multi-Tenancy
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    # Relationships
    department = relationship("Department", back_populates="requests")
    assignee = relationship("User", foreign_keys=[assigned_to_id])
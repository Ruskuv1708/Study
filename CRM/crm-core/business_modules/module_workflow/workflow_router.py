from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from system_core.database_connector import get_db
from system_core.context import get_current_workspace_id
from business_modules.module_access_control.access_security import get_current_user
from business_modules.module_workflow.workflow_service import WorkflowService
from business_modules.module_workflow.workflow_enums import RequestPriority

router = APIRouter(prefix="/workflow", tags=["Workflow Engine"])

# --- SCHEMAS (Input Forms) ---
class DepartmentCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None

class RequestCreateSchema(BaseModel):
    title: str
    description: str
    priority: RequestPriority = RequestPriority.MEDIUM
    department_id: UUID

class AssignRequestSchema(BaseModel):
    assignee_id: UUID

# --- DEPARTMENT ENDPOINTS ---
@router.post("/departments")
def create_department(
    data: DepartmentCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Admin creates a new department (e.g. 'IT Support') """
    # In real app: Check if current_user.is_admin
    workspace_id = get_current_workspace_id()
    return WorkflowService.create_department(
        db, data.name, data.description, workspace_id
    )

@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Get all buckets available in this company """
    workspace_id = get_current_workspace_id()
    return WorkflowService.list_departments(db, workspace_id)

# --- REQUEST ENDPOINTS ---
@router.post("/requests")
def create_request(
    data: RequestCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Create a ticket inside a specific department """
    workspace_id = get_current_workspace_id()
    return WorkflowService.create_request(
        db, data.title, data.description, data.priority, data.department_id, workspace_id
    )

@router.get("/requests")
def list_requests(
    department_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ List requests. Can filter by Department or Assignee. """
    workspace_id = get_current_workspace_id()
    return WorkflowService.list_requests(db, workspace_id, department_id, assignee_id)

@router.get("/requests/{request_id}")
def get_request_details(
    request_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Get ONE specific request (The detail view) """
    workspace_id = get_current_workspace_id()
    return WorkflowService.get_request_by_id(db, request_id, workspace_id)

@router.post("/requests/{request_id}/assign")
def assign_request(
    request_id: UUID,
    data: AssignRequestSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Manager assigns a ticket to a user """
    workspace_id = get_current_workspace_id()
    return WorkflowService.assign_request(db, request_id, data.assignee_id, workspace_id)
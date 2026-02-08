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
from business_modules.module_access_control.access_enums import UserRole
from business_modules.module_access_control.access_permissions import PermissionService

router = APIRouter(prefix="/workflow", tags=["Workflow Engine"])

# --- SCHEMAS (Input Forms) ---
class DepartmentCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None

class DepartmentUpdateSchema(BaseModel):
    name: Optional[str] = None
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
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Admin creates a new department (e.g. 'IT Support') """
    PermissionService.require_permission(current_user, "create_department")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.create_department(
        db, data.name, data.description, workspace_id
    )

@router.get("/departments")
def list_departments(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Get all buckets available in this company """
    PermissionService.require_permission(current_user, "create_department")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.list_departments(db, workspace_id)

@router.put("/departments/{department_id}")
def update_department(
    department_id: UUID,
    data: DepartmentUpdateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "edit_department")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.update_department(db, department_id, workspace_id, data.name, data.description)

@router.delete("/departments/{department_id}")
def delete_department(
    department_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "delete_department")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.delete_department(db, department_id, workspace_id)

# --- REQUEST ENDPOINTS ---
@router.post("/requests")
def create_request(
    data: RequestCreateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Create a ticket inside a specific department """
    PermissionService.require_permission(current_user, "create_request")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.create_request(
        db, data.title, data.description, data.priority, data.department_id, workspace_id, current_user
    )

@router.get("/requests")
def list_requests(
    department_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ List requests. Can filter by Department or Assignee. """
    if current_user.role == UserRole.USER:
        PermissionService.require_permission(current_user, "view_own_requests")
    elif current_user.role == UserRole.MANAGER:
        PermissionService.require_permission(current_user, "view_department_requests")
    else:
        PermissionService.require_permission(current_user, "view_all_requests")

    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.list_requests(db, workspace_id, current_user, department_id, assignee_id)

@router.get("/requests/{request_id}")
def get_request_details(
    request_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Get ONE specific request (The detail view) """
    if current_user.role == UserRole.USER:
        PermissionService.require_permission(current_user, "view_own_requests")
    elif current_user.role == UserRole.MANAGER:
        PermissionService.require_permission(current_user, "view_department_requests")
    else:
        PermissionService.require_permission(current_user, "view_all_requests")

    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.get_request_by_id(db, request_id, workspace_id, current_user)

@router.post("/requests/{request_id}/assign")
def assign_request(
    request_id: UUID,
    data: AssignRequestSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Manager assigns a ticket to a user """
    PermissionService.require_permission(current_user, "assign_request")
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id
    if not workspace_id:
        raise HTTPException(400, detail="Workspace is required")
    return WorkflowService.assign_request(db, request_id, data.assignee_id, workspace_id, current_user)

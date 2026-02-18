from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID

from core.database_connector import get_db
from core.config import settings
from core.workspace_resolver import resolve_workspace_id
from modules.access_control.access_security import get_current_user
from modules.workflow.workflow_service import WorkflowService
from modules.workflow.workflow_enums import RequestPriority
from modules.access_control.access_enums import UserRole
from modules.access_control.access_permissions import PermissionService

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

class RequestStatusSchema(BaseModel):
    status: str

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
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.create_department(
        db, data.name, data.description, target_workspace
    )

@router.get("/departments")
def list_departments(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    """ Get all buckets available in this company """
    PermissionService.require_permission(current_user, "view_departments")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.list_departments(db, target_workspace, skip, limit)

@router.put("/departments/{department_id}")
def update_department(
    department_id: UUID,
    data: DepartmentUpdateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "edit_department")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.update_department(db, department_id, target_workspace, data.name, data.description)

@router.delete("/departments/{department_id}")
def delete_department(
    department_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "delete_department")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.delete_department(db, department_id, target_workspace)

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
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.create_request(
        db, data.title, data.description, data.priority, data.department_id, target_workspace, current_user
    )

@router.get("/requests")
def list_requests(
    department_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    """ List requests. Can filter by Department or Assignee. """
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_requests")
    elif current_user.role == UserRole.MANAGER:
        PermissionService.require_permission(current_user, "view_department_requests")
    else:
        PermissionService.require_permission(current_user, "view_all_requests")
    workspace_context = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.list_requests(db, workspace_context, current_user, department_id, assignee_id, skip, limit)

@router.get("/requests/history")
def list_request_history(
    department_id: Optional[UUID] = None,
    assignee_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    """ List done requests for history """
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_requests")
    elif current_user.role == UserRole.MANAGER:
        PermissionService.require_permission(current_user, "view_department_requests")
    else:
        PermissionService.require_permission(current_user, "view_all_requests")
    workspace_context = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.list_done_requests(db, workspace_context, current_user, department_id, assignee_id, skip, limit)

@router.get("/requests/{request_id}")
def get_request_details(
    request_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Get ONE specific request (The detail view) """
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_requests")
    elif current_user.role == UserRole.MANAGER:
        PermissionService.require_permission(current_user, "view_department_requests")
    else:
        PermissionService.require_permission(current_user, "view_all_requests")
    workspace_context = resolve_workspace_id(current_user, workspace_id)
    req = WorkflowService.get_request_by_id(db, request_id, workspace_context, current_user)
    return WorkflowService._serialize_request(req)

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
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.assign_request(db, request_id, data.assignee_id, target_workspace, current_user)


@router.post("/requests/{request_id}/unassign")
def unassign_request(
    request_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Remove assignee """
    PermissionService.require_permission(current_user, "assign_request")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.unassign_request(db, request_id, target_workspace, current_user)


@router.put("/requests/{request_id}/status")
def update_request_status(
    request_id: UUID,
    data: RequestStatusSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update request status"""
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "edit_own_request")
    else:
        PermissionService.require_permission(current_user, "edit_request")
    workspace_context = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.update_request_status(db, request_id, workspace_context, data.status, current_user)


@router.delete("/requests/{request_id}")
def delete_request(
    request_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "delete_own_request")
    else:
        PermissionService.require_permission(current_user, "delete_request")
    workspace_context = resolve_workspace_id(current_user, workspace_id)
    return WorkflowService.delete_request(db, request_id, workspace_context, current_user)

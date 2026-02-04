from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
import logging
from typing import List
from system_core.database_connector import get_db
from business_modules.module_access_control.access_security import get_current_user
from business_modules.module_access_control.access_models import User
from business_modules.module_access_control.access_enums import UserRole
from business_modules.module_access_control.access_permissions import PermissionService
from business_modules.module_superadmin.superadmin_schemas import (
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
    WorkspaceResponseSchema,
)
from business_modules.module_superadmin.superadmin_service import SuperadminService

# Setup logging for security events
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/superadmin",
    tags=["Superadmin - Workspace Management"]
)

# ========================================
# SECURITY DECORATOR
# ========================================

def require_superadmin_access(func):
    """
    Decorator to ensure only superadmin can access endpoint
    Logs all access attempts
    """
    async def wrapper(
        *args,
        current_user = Depends(get_current_user),
        **kwargs
    ):
        # Check role
        if current_user.role != UserRole.SUPERADMIN:
            # Log failed attempt
            logger.warning(
                f"🚨 SECURITY ALERT: Unauthorized superadmin access attempt\n"
                f"   User: {current_user.email}\n"
                f"   Role: {current_user.role}\n"
                f"   Timestamp: {datetime.utcnow()}"
            )
            raise HTTPException(
                status_code=403,
                detail="Access denied: Superadmin privileges required"
            )
        
        # Log successful access
        logger.info(
            f"✅ Superadmin access - User: {current_user.email} - "
            f"Endpoint: {func.__name__}"
        )
        
        # Call the actual function
        return await func(*args, current_user=current_user, **kwargs)
    
    return wrapper

# ========================================
# WORKSPACE MANAGEMENT ENDPOINTS
# ========================================

@router.post("/workspaces", response_model=dict)
async def create_workspace(
    data: WorkspaceCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Create a new workspace (Superadmin only)
    
    Protection:
    - JWT token validation
    - Role check (SUPERADMIN only)
    - Audit logging
    """
    # Double-check superadmin role
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    
    try:
        result = SuperadminService.create_workspace(
            db,
            data.workspace_name,
            data.workspace_subdomain,
            data.admin_full_name,
            data.admin_email,
            data.admin_password
        )
        
        # Audit log
        logger.info(
            f"✅ AUDIT: Workspace created by {current_user.email}\n"
            f"   Workspace: {data.workspace_name}\n"
            f"   Subdomain: {data.workspace_subdomain}\n"
            f"   Timestamp: {datetime.utcnow()}"
        )
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Error creating workspace: {e}")
        raise

@router.get("/workspaces", response_model=List[WorkspaceResponseSchema]) # <--- CHANGE THIS
async def list_workspaces(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all workspaces (Superadmin only)
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    
    logger.info(f"✅ Workspaces listed by {current_user.email}")
    
    # This returns SQLAlchemy objects, but FastAPI will now use 
    # WorkspaceResponseSchema to convert them automatically.
    return SuperadminService.list_workspaces(db)
    
@router.get("/workspaces/{workspace_id}", response_model=dict)
async def get_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get workspace details"""
    from business_modules.module_superadmin.superadmin_models import Workspace

    
    # Everyone can view their own workspace
    # Superadmin can view any workspace
    if current_user.role != UserRole.SUPERADMIN and current_user.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Cannot view other workspaces")
    
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {
        "id": str(workspace.id),
        "name": workspace.name,
        "is_active": workspace.is_active,
        "created_at": workspace.created_at
    }

@router.post("/workspaces/{workspace_id}/suspend")
async def suspend_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Suspend a workspace (Superadmin only)
    CRITICAL: All users in workspace will be deactivated
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    
    logger.warning(
        f"🚨 CRITICAL: Workspace suspension by {current_user.email}\n"
        f"   Workspace ID: {workspace_id}\n"
        f"   Timestamp: {datetime.utcnow()}"
    )
    
    return SuperadminService.suspend_workspace(db, workspace_id)

@router.get("/workspaces")
def get_all_workspaces(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all workspaces (Superadmin only)
    ✅ SECURE: Only superadmins can view all workspaces
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only superadmins can view all workspaces"
        )
    
    # Import workspace model (adjust based on your structure)
    from business_modules.module_superadmin.superadmin_models import Workspace

    
    Workspaces = db.query(Workspace).all()
    
    return [
        {
            "id": str(w.id),
            "name": w.name,
            "is_active": w.is_active
        }
        for w in Workspaces
    ]

@router.get("/workspaces")
def get_all_workspaces(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all workspaces with user counts (Superadmin only)"""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin only")
    
    from business_modules.module_workflow.workflow_models import Workspace
    from sqlalchemy import func
    
    workspaces = db.query(
        Workspace.id,
        Workspace.name,
        Workspace.is_active,
        func.count(User.id).label('user_count')
    ).outerjoin(User).group_by(Workspace.id).all()
    
    return [
        {
            "id": str(ws.id),
            "name": ws.name,
            "is_active": ws.is_active,
            "user_count": ws.user_count
        }
        for ws in workspaces
    ]

@router.put("/workspaces/{workspace_id}/suspend")
def suspend_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Suspend a workspace (Superadmin only)"""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin only")
    
        
    
    workspace = db.query(workspace).filter(workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace.is_active = False
    db.commit()
    
    return {"message": f"Workspace '{workspace.name}' suspended"}


@router.put("/workspaces/{workspace_id}/activate")
def activate_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Activate a workspace (Superadmin only)"""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin only")
    
        
    
    workspace = db.query(workspace).filter(workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace.is_active = True
    db.commit()
    
    return {"message": f"Workspace '{workspace.name}' activated"}

@router.put("/workspaces/{workspace_id}")
def update_workspace(
    workspace_id: UUID,
    data: WorkspaceUpdateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update workspace details (Superadmin only)"""
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Superadmin only")
    
        
    
    workspace = db.query(workspace).filter(workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Update fields
    if data.workspace_name is not None:
        workspace.name = data.workspace_name
    if data.is_active is not None:
        workspace.is_active = data.is_active
    
    db.commit()
    
    return {"message": f"Workspace '{workspace.name}' updated successfully"}
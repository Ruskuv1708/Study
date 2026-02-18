from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from passlib.context import CryptContext

from core.database_connector import get_db
from core.config import settings
from modules.access_control.access_security import get_current_user
from core.security import create_access_token
from modules.access_control.access_models import User, Workspace
from modules.access_control.access_enums import UserRole
from modules.access_control.access_permissions import PermissionService
from modules.access_control.access_service import AccessService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/access", tags=["Access Control"])

# --- SCHEMAS ---
class UserCreateSchema(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole = UserRole.USER
    workspace_id: Optional[UUID] = None
    department_id: Optional[UUID] = None

class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    department_id: Optional[UUID] = None

class UserResponseSchema(BaseModel):
    id: UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    workspace_id: Optional[UUID] = None
    department_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)

class RoleUpdateSchema(BaseModel):
    new_role: str
    department_id: Optional[UUID] = None

# ========================================
# AUTHENTICATION ENDPOINTS
# ========================================

@router.post("/token")
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """Login endpoint - returns JWT token"""
    user = db.query(User).filter(User.email == username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    if user.workspace_id:
        workspace = db.query(Workspace).filter(Workspace.id == user.workspace_id).first()
        if not workspace or not workspace.is_active:
            raise HTTPException(status_code=403, detail="Workspace is suspended")
    
    if not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(user_id=str(user.id), role=user.role.value)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value
        }
    }

# ========================================
# USER MANAGEMENT ENDPOINTS
# ========================================

@router.post("/users")
def create_user(
    data: UserCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new user account (Superadmin/Admin only)"""
    PermissionService.require_permission(current_user, "create_user")

    if data.role == UserRole.SUPERADMIN and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Only superadmin can create superadmin accounts")
    
    # ✅ Superadmin can create users in any workspace
    if current_user.role == UserRole.SUPERADMIN:
        workspace_id = data.workspace_id
    elif current_user.role == UserRole.ADMIN:
        workspace_id = current_user.workspace_id
        if data.role in (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SYSTEM_ADMIN):
            raise HTTPException(status_code=403, detail="Admin cannot create admin or superadmin accounts")
    elif current_user.role == UserRole.MANAGER:
        workspace_id = current_user.workspace_id
        if data.role not in (UserRole.USER, UserRole.VIEWER):
            raise HTTPException(status_code=403, detail="Managers can only create ordinary users")
        data.workspace_id = workspace_id
        if not data.department_id and current_user.department_id:
            data.department_id = current_user.department_id
    else:
        workspace_id = current_user.workspace_id

    if data.role != UserRole.SUPERADMIN and not workspace_id:
        raise HTTPException(
            status_code=400,
            detail="workspace_id is required for this role"
        )

    
    return AccessService.create_user(
        db, data.full_name, data.email, data.password, data.role, workspace_id, data.department_id
    )

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    workspace_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
) -> List[UserResponseSchema]:
    """
    List all user accounts
    ✅ Regular users see: only their own workspace
    ✅ Superadmin sees: all users (should filter by workspace_id in frontend)
    """
    PermissionService.require_permission(current_user, "view_all_users")
    
    # ✅ Non-superadmins only see users from their workspace
    if current_user.role != UserRole.SUPERADMIN:
        workspace_id = current_user.workspace_id

    limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
    skip = max(skip, 0)
    query = db.query(User)
    if workspace_id:
        query = query.filter(User.workspace_id == workspace_id)
    users = query.offset(skip).limit(limit).all()
    
    return users

@router.get("/departments/{department_id}/users")
def list_department_users(
    department_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
) -> List[UserResponseSchema]:
    """List users assigned to a department (manager-friendly)"""
    PermissionService.require_permission(current_user, "view_department_users")

    if current_user.role in (UserRole.SUPERADMIN, UserRole.SYSTEM_ADMIN):
        workspace_id = None
    else:
        workspace_id = current_user.workspace_id

    limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
    skip = max(skip, 0)
    query = db.query(User).filter(User.department_id == department_id)
    if workspace_id:
        query = query.filter(User.workspace_id == workspace_id)
    return query.offset(skip).limit(limit).all()

@router.get("/users/{user_id}")
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> UserResponseSchema:
    """Get specific user account details"""
    if current_user.role == UserRole.SUPERADMIN:
        user = db.query(User).filter(User.id == user_id).first()
    else:
        workspace_id = current_user.workspace_id
        user = db.query(User).filter(
            User.id == user_id,
            User.workspace_id == workspace_id
        ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")
    
    return user

@router.put("/users/{user_id}")
def update_user(
    user_id: UUID,
    data: UserUpdateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> UserResponseSchema:
    """Update user account details (Superadmin/Admin only)"""
    PermissionService.require_permission(current_user, "edit_user")
    
    # ✅ Superadmin can update users in any workspace
    if current_user.role == UserRole.SUPERADMIN:
        workspace_id = None
    else:
        workspace_id = current_user.workspace_id
    
    query = db.query(User).filter(User.id == user_id)
    if workspace_id:
        query = query.filter(User.workspace_id == workspace_id)
    target_user = query.first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")
    
    # Admin/System Admin cannot edit admins/superadmins
    if current_user.role in (UserRole.ADMIN, UserRole.SYSTEM_ADMIN) and target_user.role in (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SYSTEM_ADMIN):
        raise HTTPException(status_code=403, detail="Admin cannot edit admin or superadmin accounts")

    if data.department_id is not None:
        PermissionService.require_permission(current_user, "assign_departments")
    
    return AccessService.update_user(db, user_id, data, workspace_id)

@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Deactivate user account (Superadmin/Admin)"""
    PermissionService.require_permission(current_user, "delete_user")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    workspace_id = None if current_user.role == UserRole.SUPERADMIN else current_user.workspace_id
    return AccessService.delete_user(db, user_id, workspace_id)

# ADD THIS NEW ENDPOINT

@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: UUID,
    data: RoleUpdateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update user role (Admin/Superadmin only)
    ✅ SECURE: Only authorized users can change roles
    """
    # ✅ Check permission
    PermissionService.require_permission(current_user, "manage_roles")
    
    workspace_id = current_user.workspace_id
    
    # Prevent self-role-change
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot change your own role. Ask another admin to do this."
        )
    
    query = db.query(User).filter(User.id == user_id)
    if current_user.role != UserRole.SUPERADMIN:
        query = query.filter(User.workspace_id == workspace_id)
    target_user = query.first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role
    try:
        parsed_role = UserRole[data.new_role.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.new_role}")

    if current_user.role == UserRole.ADMIN and parsed_role in (UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.SYSTEM_ADMIN):
        raise HTTPException(status_code=403, detail="Admin cannot set admin, system admin, or superadmin roles")

    if current_user.role == UserRole.SYSTEM_ADMIN and parsed_role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="System admin cannot set superadmin role")

    if current_user.role != UserRole.SUPERADMIN and target_user.role == UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Cannot modify superadmin accounts")

    update_values = {"role": parsed_role}
    if parsed_role in (UserRole.MANAGER, UserRole.USER):
        if data.department_id is None and target_user.department_id is None:
            raise HTTPException(status_code=400, detail="Department is required for manager and user roles")
        if data.department_id is not None:
            update_values["department_id"] = data.department_id
    else:
        update_values["department_id"] = None

    query.update(update_values, synchronize_session=False)
    db.commit()
    target_user = db.query(User).filter(User.id == user_id).first()
    
    return {
        "message": f"User role updated to {data.new_role}",
        "user": {
            "id": str(target_user.id),
            "email": target_user.email,
            "role": target_user.role.value
        }
    }

# ========================================
# CURRENT USER ENDPOINTS
# ========================================

@router.get("/me")
def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current logged-in user info"""
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role.value,
        "workspace_id": current_user.workspace_id,
        "department_id": current_user.department_id,
        "is_active": current_user.is_active
    }

@router.put("/me")
def update_current_user(
    data: UserUpdateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update own profile (name/email only)
    ⚠️ SECURITY: Users CANNOT change their own role
    """
    workspace_id = current_user.workspace_id
    
    # ✅ FIX: Only allow name and email updates, NEVER role changes
    update_data = UserUpdateSchema(
        full_name=data.full_name,
        email=data.email,
        role=None,  # ✅ Force role to None (won't be updated)
        is_active=None  # ✅ Force is_active to None (won't be updated)
    )
    
    return AccessService.update_user(db, current_user.id, update_data, workspace_id)

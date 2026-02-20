from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from uuid import uuid4
from passlib.context import CryptContext

from core.database_connector import get_db
from core.config import settings
from modules.access_control.access_security import get_current_user
from core.security import create_access_token
from modules.access_control.access_models import User, Workspace
from modules.access_control.access_enums import UserRole
from modules.access_control.access_permissions import PermissionService
from modules.access_control.access_service import AccessService
from modules.workflow.workflow_models import Department

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
    rank_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class RoleUpdateSchema(BaseModel):
    new_role: str
    department_id: Optional[UUID] = None

class DepartmentRankCreateSchema(BaseModel):
    name: str

class UserRankAssignSchema(BaseModel):
    department_id: UUID
    rank_id: Optional[str] = None


def _read_rank_id(user: User) -> Optional[str]:
    meta = user.meta_data if isinstance(user.meta_data, dict) else {}
    rank_id = meta.get("department_rank_id")
    if rank_id is None:
        return None
    return str(rank_id)


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "workspace_id": user.workspace_id,
        "department_id": user.department_id,
        "rank_id": _read_rank_id(user),
    }


def _extract_department_ranks(department: Department) -> list[dict]:
    meta = department.meta_data if isinstance(department.meta_data, dict) else {}
    raw_ranks = meta.get("ranks")
    if not isinstance(raw_ranks, list):
        return []

    normalized: list[dict] = []
    seen_ids: set[str] = set()
    for item in raw_ranks:
        if not isinstance(item, dict):
            continue
        rank_id = str(item.get("id") or "").strip()
        rank_name = str(item.get("name") or "").strip()
        if not rank_id or not rank_name or rank_id in seen_ids:
            continue
        seen_ids.add(rank_id)
        try:
            order = int(item.get("order"))
        except (TypeError, ValueError):
            order = len(normalized) + 1
        normalized.append({
            "id": rank_id,
            "name": rank_name,
            "order": order,
        })

    normalized.sort(key=lambda rank: (rank.get("order", 999999), rank.get("name", "").lower()))
    return normalized


def _can_manage_department(current_user, department_id: UUID) -> bool:
    if current_user.role != UserRole.MANAGER:
        return True
    return current_user.department_id == department_id


def _resolve_department_for_user(current_user, db: Session, department_id: UUID) -> Department:
    query = db.query(Department).filter(Department.id == department_id)
    if current_user.role not in (UserRole.SUPERADMIN, UserRole.SYSTEM_ADMIN):
        query = query.filter(Department.workspace_id == current_user.workspace_id)
    department = query.first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department

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
    return [_serialize_user(user) for user in users]

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
    users = query.offset(skip).limit(limit).all()
    return [_serialize_user(user) for user in users]

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
    return _serialize_user(user)


@router.get("/departments/{department_id}/ranks")
def list_department_ranks(
    department_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "view_department_users")

    department = _resolve_department_for_user(current_user, db, department_id)

    if current_user.role in (UserRole.MANAGER, UserRole.USER, UserRole.VIEWER):
        if current_user.department_id != department.id:
            raise HTTPException(status_code=403, detail="Permission denied: insufficient privileges")

    return _extract_department_ranks(department)


@router.post("/departments/{department_id}/ranks")
def create_department_rank(
    department_id: UUID,
    data: DepartmentRankCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "manage_department_ranks")

    department = _resolve_department_for_user(current_user, db, department_id)
    if not _can_manage_department(current_user, department.id):
        raise HTTPException(status_code=403, detail="Managers can only manage ranks in their own department")

    rank_name = data.name.strip()
    if not rank_name:
        raise HTTPException(status_code=400, detail="Rank name is required")

    ranks = _extract_department_ranks(department)
    duplicate = next((rank for rank in ranks if rank["name"].lower() == rank_name.lower()), None)
    if duplicate:
        raise HTTPException(status_code=400, detail="Rank already exists in this department")

    next_order = max([rank.get("order", 0) for rank in ranks], default=0) + 1
    created_rank = {
        "id": str(uuid4()),
        "name": rank_name,
        "order": next_order,
    }
    ranks.append(created_rank)
    ranks.sort(key=lambda rank: (rank.get("order", 999999), rank.get("name", "").lower()))

    meta = dict(department.meta_data or {})
    meta["ranks"] = ranks
    department.meta_data = meta
    db.commit()

    return created_rank


@router.put("/users/{user_id}/rank")
def assign_user_rank(
    user_id: UUID,
    data: UserRankAssignSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "assign_user_rank")

    department = _resolve_department_for_user(current_user, db, data.department_id)
    if not _can_manage_department(current_user, department.id):
        raise HTTPException(status_code=403, detail="Managers can only assign ranks in their own department")

    user_query = db.query(User).filter(User.id == user_id)
    if current_user.role != UserRole.SUPERADMIN:
        user_query = user_query.filter(User.workspace_id == current_user.workspace_id)
    target_user = user_query.first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.department_id != department.id:
        raise HTTPException(status_code=400, detail="User is not assigned to this department")

    rank_id = data.rank_id.strip() if data.rank_id else None
    if rank_id:
        ranks = _extract_department_ranks(department)
        if not any(rank["id"] == rank_id for rank in ranks):
            raise HTTPException(status_code=400, detail="Rank not found in this department")

    user_meta = dict(target_user.meta_data or {})
    if rank_id:
        user_meta["department_rank_id"] = rank_id
    else:
        user_meta.pop("department_rank_id", None)
    target_user.meta_data = user_meta
    db.commit()
    db.refresh(target_user)

    return _serialize_user(target_user)

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

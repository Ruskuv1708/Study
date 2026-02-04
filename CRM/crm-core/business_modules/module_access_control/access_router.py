from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from passlib.context import CryptContext

from system_core.database_connector import get_db
from business_modules.module_access_control.access_security import get_current_user, create_access_token
from business_modules.module_access_control.access_models import User
from business_modules.module_access_control.access_enums import UserRole
from business_modules.module_access_control.access_permissions import PermissionService
from business_modules.module_access_control.access_service import AccessService

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/access", tags=["Access Control"])

# --- SCHEMAS ---
class UserCreateSchema(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole = UserRole.USER

class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponseSchema(BaseModel):
    id: UUID
    full_name: str
    email: str
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True

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
    
    if not pwd_context.verify(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(user_id=str(user.id), role=user.role)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
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
    
    # ✅ Use current_user's workspace_id
    workspace_id = current_user.workspace_id
    
    if not workspace_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot determine workspace. User must have valid workspace assignment."
        )
    
    return AccessService.create_user(
        db, data.full_name, data.email, data.password, data.role, workspace_id
    )

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
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
        users = db.query(User).filter(User.workspace_id == workspace_id).all()
    else:
        # ✅ Superadmins see all users
        users = db.query(User).all()
    
    return users

@router.get("/users/{user_id}")
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
) -> UserResponseSchema:
    """Get specific user account details"""
    # ✅ Use current_user's workspace_id
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
    
    # ✅ Use current_user's workspace_id
    workspace_id = current_user.workspace_id
    
    target_user = db.query(User).filter(
        User.id == user_id,
        User.workspace_id == workspace_id
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User account not found")
    
    # Admin cannot edit higher-ranked users
    if current_user.role == UserRole.ADMIN:
        PermissionService.require_role(target_user, UserRole.MANAGER)
    
    return AccessService.update_user(db, user_id, data, workspace_id)

@router.delete("/users/{user_id}")
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Deactivate user account (Superadmin only)"""
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    
    # ✅ Use current_user's workspace_id
    workspace_id = current_user.workspace_id
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    return AccessService.delete_user(db, user_id, workspace_id)

# ADD THIS NEW ENDPOINT

@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: UUID,
    new_role: str,  # Just accept role as string
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
    
    target_user = db.query(User).filter(
        User.id == user_id,
        User.workspace_id == workspace_id
    ).first()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role
    try:
        target_user.role = UserRole[new_role.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {new_role}")
    
    db.commit()
    db.refresh(target_user)
    
    return {
        "message": f"User role updated to {new_role}",
        "user": {
            "id": str(target_user.id),
            "email": target_user.email,
            "role": target_user.role
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
        "role": current_user.role,
        "workspace_id": current_user.workspace_id,
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
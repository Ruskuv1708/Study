from sqlalchemy.orm import Session
from passlib.context import CryptContext
from fastapi import HTTPException
from uuid import UUID

from modules.access_control.access_models import User
from modules.access_control.access_enums import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AccessService:
    """User account management service"""

    @staticmethod
    def create_user(
        db: Session,
        full_name: str,
        email: str,
        password: str,
        role: UserRole,
        workspace_id: UUID,
        department_id: UUID | None = None
    ):
        """Create a new user account"""
        # Check if email already exists
        existing = db.query(User).filter(User.email == email).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")

        # Superadmin is not tied to a workspace
        if role == UserRole.SUPERADMIN:
            workspace_id = None
            department_id = None
        else:
            if not workspace_id:
                raise HTTPException(status_code=400, detail="Workspace is required for non-superadmin users")
            if role in (UserRole.MANAGER, UserRole.USER) and not department_id:
                raise HTTPException(status_code=400, detail="Department is required for manager and user roles")

        user = User(
            full_name=full_name,
            email=email,
            hashed_password=pwd_context.hash(password),
            role=role,
            is_active=True,
            workspace_id=workspace_id,
            department_id=department_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user(db: Session, user_id: UUID, data, workspace_id: UUID):
        """Update user account"""
        query = db.query(User).filter(User.id == user_id)
        if workspace_id:
            query = query.filter(User.workspace_id == workspace_id)
        user = query.first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")

        # ✅ Only update these fields if provided
        if data.full_name:
            user.full_name = data.full_name
        
        if data.email:
            # Check if new email is taken
            existing_query = db.query(User).filter(
                User.email == data.email,
                User.id != user_id,
            )
            existing = existing_query.first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = data.email

        if getattr(data, "model_fields_set", None) is not None:
            if "department_id" in data.model_fields_set:
                user.department_id = data.department_id
        elif data.department_id is not None:
            user.department_id = data.department_id

        if data.is_active is not None:
            user.is_active = data.is_active
        
        # ✅ SECURITY: These fields can only be changed by admin, not self-service
        # if data.role:
        #     user.role = data.role
        # if data.is_active is not None:
        #     user.is_active = data.is_active

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def delete_user(db: Session, user_id: UUID, workspace_id: UUID):
        """Deactivate user account (soft delete)"""
        query = db.query(User).filter(User.id == user_id)
        if workspace_id:
            query = query.filter(User.workspace_id == workspace_id)
        user = query.first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")

        user.is_active = False
        db.commit()
        return {"message": f"User account '{user.full_name}' deactivated"}

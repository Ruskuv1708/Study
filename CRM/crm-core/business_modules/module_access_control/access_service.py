from sqlalchemy.orm import Session
from passlib.context import CryptContext
from fastapi import HTTPException
from uuid import UUID

from business_modules.module_access_control.access_models import User
from business_modules.module_access_control.access_enums import UserRole

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
        workspace_id: UUID
    ):
        """Create a new user account"""
        # Check if email already exists in workspace
        existing = db.query(User).filter(
            User.email == email,
            User.workspace_id == workspace_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists in this workspace")

        user = User(
            full_name=full_name,
            email=email,
            hashed_password=pwd_context.hash(password),
            role=role,
            is_active=True,
            workspace_id=workspace_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user(db: Session, user_id: UUID, data, workspace_id: UUID):
        """Update user account"""
        user = db.query(User).filter(
            User.id == user_id,
            User.workspace_id == workspace_id
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")

        # ✅ Only update these fields if provided
        if data.full_name:
            user.full_name = data.full_name
        
        if data.email:
            # Check if new email is taken
            existing = db.query(User).filter(
                User.email == data.email,
                User.id != user_id,
                User.workspace_id == workspace_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = data.email
        
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
        user = db.query(User).filter(
            User.id == user_id,
            User.workspace_id == workspace_id
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User account not found")

        user.is_active = False
        db.commit()
        return {"message": f"User account '{user.full_name}' deactivated"}
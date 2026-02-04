from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from fastapi import HTTPException
from uuid import UUID
from datetime import datetime

from business_modules.module_superadmin.superadmin_models import Workspace
from business_modules.module_access_control.access_models import User, Workspace
from business_modules.module_access_control.access_enums import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SuperadminService:
    """
    Business logic for Workspace management (Superadmin only)
    """

    @staticmethod
    def create_workspace(
        db: Session,
        workspace_name: str,
        workspace_subdomain: str,
        admin_full_name: str,
        admin_email: str,
        admin_password: str
    ) -> dict:
        """
        Create a new workspace with workspace admin user
        Returns workspace info with admin credentials
        """
        # 1. Check if subdomain already exists
        existing_workspace = db.query(Workspace).filter(
            Workspace.subdomain_prefix == workspace_subdomain
        ).first()
        
        if existing_workspace:
            raise HTTPException(
                status_code=400,
                detail=f"Subdomain '{workspace_subdomain}' is already taken"
            )
        
        # 2. Check if email already exists globally
        existing_user = db.query(User).filter(User.email == admin_email).first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"Email '{admin_email}' is already registered"
            )
        
        # 3. Create Workspace
        workspace = Workspace(
            name=workspace_name,
            subdomain_prefix=workspace_subdomain,
            admin_email=admin_email,
            admin_full_name=admin_full_name,
            status="active",
            is_active=True,
            created_at=datetime.utcnow(),
            activated_at=datetime.utcnow(),
            settings={
                "features_enabled": ["workflow", "file_storage", "reports", "notifications"],
                "plan": "professional"
            }
        )
        db.add(workspace)
        db.flush()  # Get workspace ID without committing
        
        # 4. Create workspace entry (for multi-tenancy in other modules)
        workspace = workspace(
            name=workspace_name,
            subdomain_prefix=workspace_subdomain,
            is_active=True
        )
        db.add(workspace)
        db.flush()
        
        # 5. Create Workspace Admin User
        workspace_admin = User(
            full_name=admin_full_name,
            email=admin_email,
            hashed_password=pwd_context.hash(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
            workspace_id=workspace.id
        )
        db.add(workspace_admin)
        
        # Commit all changes
        db.commit()
        db.refresh(workspace)
        
        return {
            "workspace_id": str(workspace.id),
            "workspace_name": workspace.name,
            "subdomain": workspace.subdomain_prefix,
            "admin_email": admin_email,
            "message": "Workspace created successfully. Admin can now login."
        }

    @staticmethod
    def list_workspaces(db: Session, skip: int = 0, limit: int = 100) -> list:
        """Get all workspaces (paginated)"""
        return db.query(Workspace).offset(skip).limit(limit).all()

    @staticmethod
    def get_workspace(db: Session, workspace_id: UUID) -> Workspace:
        """Get specific workspace details"""
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        return workspace

    @staticmethod
    def get_workspace_by_subdomain(db: Session, subdomain: str) -> Workspace:
        """Get workspace by subdomain (for routing)"""
        workspace = db.query(Workspace).filter(
            Workspace.subdomain_prefix == subdomain
        ).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        return workspace

    @staticmethod
    def update_workspace(
        db: Session,
        workspace_id: UUID,
        workspace_name: str = None,
        status: str = None,
        settings: dict = None
    ) -> Workspace:
        """Update workspace settings"""
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        if workspace_name:
            workspace.name = workspace_name
        if status:
            workspace.status = status
        if settings:
            workspace.settings = {**workspace.settings, **settings}
        
        db.commit()
        db.refresh(workspace)
        return workspace

    @staticmethod
    def suspend_workspace(db: Session, workspace_id: UUID) -> dict:
        """Suspend a workspace (deactivate all users)"""
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Deactivate all users in this workspace
        db.query(User).filter(
            User.workspace_id == workspace_id
        ).update({"is_active": False})
        
        workspace.is_active = False
        workspace.status = "suspended"
        workspace.suspended_at = datetime.utcnow()
        
        db.commit()
        return {"message": f"Workspace '{workspace.name}' has been suspended"}

    @staticmethod
    def get_workspace_stats(db: Session, workspace_id: UUID) -> dict:
        """Get workspace statistics"""
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Count users
        user_count = db.query(func.count(User.id)).filter(
            User.workspace_id == workspace_id
        ).scalar() or 0
        
        # Count requests (if requests module exists)
        try:
            from business_modules.module_workflow.workflow_models import Request
            request_count = db.query(func.count(Request.id)).filter(
                Request.workspace_id == workspace_id
            ).scalar() or 0
        except:
            request_count = 0
        
        return {
            "workspace_id": str(workspace.id),
            "workspace_name": workspace.name,
            "user_count": user_count,
            "request_count": request_count,
            "status": workspace.status,
            "created_at": workspace.created_at
        }
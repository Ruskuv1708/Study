from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import uuid4
from typing import List
from datetime import datetime
from sqlalchemy import func

from system_core.database_connector import get_db, SessionLocal
from business_modules.module_access_control.access_models import User
from business_modules.module_superadmin.superadmin_models import Workspace
from business_modules.module_access_control.access_enums import UserRole
from business_modules.module_superadmin.superadmin_schemas import (
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
    WorkspaceResponseSchema,
)
from business_modules.module_superadmin.superadmin_service import SuperadminService
from business_modules.module_access_control.access_security import get_current_user

from passlib.context import CryptContext


router = APIRouter(
    prefix="/superadmin",
    tags=["Superadmin - Workspace Management"]
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# =====================================================
# FASTAPI ENDPOINTS (API CONTEXT ONLY)
# =====================================================

@router.post("/workspaces", response_model=WorkspaceResponseSchema)
def create_workspace(
    data: WorkspaceCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=403,
            detail="Superadmin privileges required"
        )

    return SuperadminService.create_workspace(
        db,
        data.workspace_name,
        data.workspace_subdomain,
        data.admin_full_name,
        data.admin_email,
        data.admin_password
    )

# =====================================================
# BOOTSTRAP SCRIPT (CLI CONTEXT ONLY)
# =====================================================

def create_superadmin():
    db = SessionLocal()
    
    try:
        print("🔍 Checking for existing superadmin...")
        
        existing_superadmin = db.query(User).filter(
            User.role == UserRole.SUPERADMIN
        ).first()
        
        if existing_superadmin:
            print(f"❌ Superadmin already exists: {existing_superadmin.email}")
            return
        
        print("✅ No existing superadmin found, creating new one...\n")
        
        system_workspace = db.query(Workspace).filter(
            Workspace.subdomain_prefix == "system"
        ).first()
        
        if not system_workspace:
            print("📁 Creating system workspace...")
            system_workspace = Workspace(
                name="System Administration",
                subdomain_prefix="system",
                is_active=True
            )
            db.add(system_workspace)
            db.flush()
            print("✅ System workspace created")
        else:
            print("✅ System workspace already exists")
        
        print("👤 Creating superadmin user...")
        superadmin = User(
            id=uuid4(),
            email="need4spd1708@gmail.com",
            full_name="System Superadmin",
            hashed_password=pwd_context.hash("Ruslan!708"),
            role=UserRole.SUPERADMIN,
            is_active=True,
            workspace_id=system_workspace.id,
            created_at=datetime.utcnow()
        )
        db.add(superadmin)
        db.commit()
        
        print("\n" + "="*60)
        print("✅ SUPERADMIN CREATED SUCCESSFULLY!")
        print("="*60)
        print(f"📧 Email:    need4spd1708@gmail.com")
        print(f"🔐 Password: Ruslan!708")
        print("="*60)
        print("⚠️  IMPORTANT: Change this password immediately after first login!")
        print("="*60 + "\n")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating superadmin: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

# =====================================================
# SCRIPT ENTRY POINT
# =====================================================

if __name__ == "__main__":
    create_superadmin()

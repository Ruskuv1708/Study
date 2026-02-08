import sys
import os
from datetime import datetime

# Add project root to path
sys.path.append(os.getcwd())

from system_core.database_connector import SessionLocal
# Import Workspace instead of Tenant
from business_modules.module_access_control.access_models import User, Workspace 
from business_modules.module_access_control.access_enums import UserRole
from passlib.context import CryptContext
from business_modules.module_access_control.access_enums import WorkspaceStatus

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_superadmin():
    db = SessionLocal()
    try:
        print("🔍 Checking for existing superadmin...")
        
        # Check if user exists
        existing_superadmin = db.query(User).filter(
            User.role == UserRole.SUPERADMIN
        ).first()
        
        if existing_superadmin:
            print(f"❌ Superadmin already exists: {existing_superadmin.email}")
            return
        
        print("✅ No existing superadmin found.")
        
        # 1. Find or Create System Workspace
        system_ws = db.query(Workspace).filter(
            Workspace.subdomain_prefix == "system"
        ).first()
        
        if not system_ws:
            print("📁 Creating system workspace...")
            system_ws = Workspace(
                name="System Administration",
                subdomain_prefix="system",
                admin_email="admin@example.com",       # ✅ Required
                admin_full_name="System Admin", 
                status=WorkspaceStatus.ACTIVE,
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),

            )
            db.add(system_ws)
            db.flush()
            print("✅ System workspace created")
        
        # 2. Create User
        print("👤 Creating superadmin user...")
        superadmin = User(
            email="need4spd1708@gmail.com",
            full_name="System Superadmin",
            hashed_password=pwd_context.hash("Ruslan!708"),
            role=UserRole.SUPERADMIN,
            is_active=True,
            workspace_id=system_ws.id, # <--- Updated to workspace_id
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

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating superadmin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_superadmin()
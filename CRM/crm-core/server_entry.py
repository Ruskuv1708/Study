from fastapi import FastAPI
from contextlib import asynccontextmanager 
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# --- IMPORTS: SYSTEM CORE ---
from system_core.database_connector import engine, Base
from system_core.middleware import WorkspaceMiddleware

# --- IMPORTS: MODULE ROUTERS ---
from business_modules.module_access_control.access_router import router as access_router
from business_modules.module_superadmin.superadmin_router import router as superadmin_router  # ✅ NEW
from business_modules.module_dynamic_records.dynamic_router import router as dynamic_router
from business_modules.module_workflow.workflow_router import router as workflow_router
from business_modules.module_notifications.notif_router import router as notif_router
from business_modules.module_file_storage.file_router import router as file_router
from business_modules.module_reports.report_router import router as report_router

# --- IMPORTS: MODELS (For Table Creation) ---
from business_modules.module_access_control.access_models import User
from business_modules.module_superadmin.superadmin_models import Workspace  # ✅ NEW
from business_modules.module_dynamic_records.dynamic_models import FormTemplate, FormRecord
from business_modules.module_workflow.workflow_models import Department, Request
from business_modules.module_notifications.notif_models import Notification
from business_modules.module_file_storage.file_models import FileAttachment

# --- LIFESPAN MANAGER (Startup/Shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. STARTUP
    print("------------------------------------------------")
    print("⚡ SYSTEM STARTUP: Initiating...")
    try:
        # Check Database Connection
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("✅ DATABASE: Connected")
        
        # Create Tables
        print("🔨 MIGRATION: Checking tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ MIGRATION: Tables synced successfully")
    except Exception as e:
        print(f"❌ CRITICAL FAILURE: {e}")
    print("------------------------------------------------")
    
    yield
    
    # 2. SHUTDOWN
    print("------------------------------------------------")
    print("🛑 SYSTEM SHUTDOWN")
    print("------------------------------------------------")

# --- APP INITIALIZATION ---
crm_core_app = FastAPI(title="Modular CRM System", lifespan=lifespan) 

# --- CORS ---
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
crm_core_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WORKSPACE MIDDLEWARE ---
crm_core_app.add_middleware(WorkspaceMiddleware)

# --- REGISTER MODULES ---
crm_core_app.include_router(superadmin_router)  # ✅ Register Superadmin FIRST (highest priority)
crm_core_app.include_router(access_router)
crm_core_app.include_router(dynamic_router)
crm_core_app.include_router(workflow_router)
crm_core_app.include_router(notif_router)
crm_core_app.include_router(file_router)
crm_core_app.include_router(report_router)

# --- HEALTH CHECK ---
@crm_core_app.get("/")
def report_system_status():
    return {"status": "online"}
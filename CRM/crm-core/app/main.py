from fastapi import FastAPI
from contextlib import asynccontextmanager 
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from dotenv import load_dotenv

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()

# --- IMPORTS: SYSTEM CORE ---
from core.database_connector import engine, Base
from core.middleware import WorkspaceMiddleware
from core.config import settings

# --- IMPORTS: MODULE ROUTERS ---
from modules.access_control.access_router import router as access_router

from modules.dynamic_records.dynamic_router import router as dynamic_router
from modules.workflow.workflow_router import router as workflow_router
from modules.notifications.notif_router import router as notif_router
from modules.file_storage.file_router import router as file_router
from modules.reports.report_router import router as report_router
from modules.workspace_management.workspace_router import router as workspace_router

# --- IMPORTS: MODELS (For Table Creation) ---
from modules.access_control.access_models import User
from modules.access_control.access_models import Workspace  # ✅ NEW
from modules.dynamic_records.dynamic_models import FormTemplate, FormRecord
from modules.workflow.workflow_models import Department, Request
from modules.notifications.notif_models import Notification
from modules.file_storage.file_models import FileAttachment

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
        
        # Create Tables (Dev/Local only)
        if settings.AUTO_CREATE_TABLES:
            print("🔨 MIGRATION: Checking tables...")
            Base.metadata.create_all(bind=engine)
            print("✅ MIGRATION: Tables synced successfully")
        else:
            print("ℹ️  AUTO_CREATE_TABLES disabled; skipping create_all()")
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
if settings.CORS_ORIGINS:
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
else:
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

# --- PROXY / HOST CONTROLS ---
if settings.TRUSTED_PROXY_HOSTS:
    proxy_hosts = [h.strip() for h in settings.TRUSTED_PROXY_HOSTS.split(",") if h.strip()]
    crm_core_app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=proxy_hosts)

if settings.ALLOWED_HOSTS:
    allowed_hosts = [h.strip() for h in settings.ALLOWED_HOSTS.split(",") if h.strip()]
    crm_core_app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

# --- WORKSPACE MIDDLEWARE ---
crm_core_app.add_middleware(WorkspaceMiddleware)

# --- REGISTER MODULES ---
crm_core_app.include_router(workspace_router)  # ✅ Register Workspace Management FIRST (highest priority)
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

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from system_core.database_connector import SessionLocal
from system_core.context import workspace_context
from business_modules.module_superadmin.superadmin_models import Workspace

class WorkspaceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Get the Hostname (e.g., "apple.localhost:8000")
        host = request.headers.get("host", "").split(":")[0] 
        
        # 2. Extract Subdomain (e.g., "apple")
        # Logic: If host is "apple.crm.com", subdomain is "apple".
        # For localhost testing, we might need a header hack or /etc/hosts, 
        # but let's assume strict subdomain logic for production.
        subdomain = host.split(".")[0]
        
        # 3. Find the workspace in DB
        db = SessionLocal()
        try:
            # We look for the workspace by subdomain
            workspace = db.query(Workspace).filter(Workspace.subdomain_prefix == subdomain).first()
            
            if workspace:
                # SUCCESS: Store the ID in the Context
                token = workspace_context.set(workspace.id)
                # (Optional) We could load "Red Theme" config here later
            else:
                # If no workspace found (e.g. accessing by IP), maybe set default or None
                token = workspace_context.set(None)
                
            # 4. PROCESS THE REQUEST
            response = await call_next(request)
            return response
            
        finally:
            # Cleanup DB session
            db.close()
            # Reset Context (Good practice)
            if 'token' in locals():
                workspace_context.reset(token)
from fastapi import Request, Response
import ipaddress
from typing import Iterable
from starlette.middleware.base import BaseHTTPMiddleware
from core.database_connector import SessionLocal
from core.context import workspace_context
from core.config import settings
from modules.access_control.access_models import Workspace
from uuid import UUID


def _parse_trusted_hosts(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


TRUSTED_PROXY_HOSTS = _parse_trusted_hosts(settings.TRUSTED_PROXY_HOSTS)


def _is_trusted_proxy(client_host: str | None, trusted_hosts: Iterable[str]) -> bool:
    if not client_host:
        return False
    for entry in trusted_hosts:
        if entry == "*":
            return True
        try:
            if ipaddress.ip_address(client_host) in ipaddress.ip_network(entry, strict=False):
                return True
            continue
        except ValueError:
            # Not an IP/CIDR; treat as hostname suffix match
            if client_host == entry or client_host.endswith(f".{entry}"):
                return True
    return False

class WorkspaceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        use_forwarded = _is_trusted_proxy(
            request.client.host if request.client else None,
            TRUSTED_PROXY_HOSTS,
        )
        # 1. Check explicit workspace headers (preferred for proxies/integrations)
        workspace_id_header = request.headers.get("x-workspace-id") if use_forwarded else None
        workspace_subdomain_header = request.headers.get("x-workspace-subdomain") if use_forwarded else None

        # 2. Resolve host (respect reverse proxy headers)
        forwarded_host = request.headers.get("x-forwarded-host") if use_forwarded else None
        host = (forwarded_host or request.headers.get("host", "")).split(",")[0].split(":")[0]

        # 3. Extract Subdomain (e.g., "apple")
        # Logic: If host is "apple.crm.com", subdomain is "apple".
        subdomain = None
        if workspace_subdomain_header:
            subdomain = workspace_subdomain_header
        else:
            try:
                ipaddress.ip_address(host)
                subdomain = None
            except ValueError:
                parts = [p for p in host.split(".") if p]
                if len(parts) >= 3:
                    subdomain = parts[0]

        # 4. Find the workspace in DB
        db = SessionLocal()
        try:
            workspace = None
            if workspace_id_header:
                try:
                    workspace_uuid = UUID(workspace_id_header)
                except Exception:
                    return Response(status_code=400, content="Invalid x-workspace-id header")
                workspace = db.query(Workspace).filter(Workspace.id == workspace_uuid).first()
                if not workspace:
                    return Response(status_code=400, content="Workspace not found for x-workspace-id header")
            else:
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

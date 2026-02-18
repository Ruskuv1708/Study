from uuid import UUID
from fastapi import HTTPException

from core.context import get_current_workspace_id
from modules.access_control.access_enums import UserRole


def resolve_workspace_id(current_user, workspace_id: UUID | None) -> UUID:
    """
    Resolve the workspace for a request in a consistent, safe way.

    Rules:
    - SUPERADMIN/SYSTEM_ADMIN: must resolve to an explicit workspace (query param,
      tenant context, or current_user.workspace_id). Otherwise 400.
    - Other roles: must match current_user.workspace_id. If a different workspace
      is requested (via param or context), return 403.
    """
    context_workspace_id = get_current_workspace_id()

    if current_user.role in (UserRole.SUPERADMIN, UserRole.SYSTEM_ADMIN):
        resolved = workspace_id or context_workspace_id or current_user.workspace_id
        if not resolved:
            raise HTTPException(status_code=400, detail="Workspace is required")
        return resolved

    if not current_user.workspace_id:
        raise HTTPException(status_code=400, detail="Workspace is required")

    if workspace_id and workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=403, detail="Workspace mismatch")

    if context_workspace_id and context_workspace_id != current_user.workspace_id:
        raise HTTPException(status_code=403, detail="Workspace mismatch")

    return current_user.workspace_id

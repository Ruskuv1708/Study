from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer
from starlette.requests import Request  # ✅ Use starlette for HTTPAuthCredentials
from sqlalchemy.orm import Session

from core.database_connector import get_db
from core.context import user_context
from core.security import verify_access_token
from modules.access_control.access_models import User, Workspace

security = HTTPBearer()

async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Get current user from JWT token in Authorization header
    Expected format: Authorization: Bearer <token>
    """
    # Get token from header
    auth_header = request.headers.get("Authorization")
    
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    # Parse "Bearer <token>"
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = parts[1]
    
    # Verify token signature and expiration
    payload = verify_access_token(token)
    user_id = payload.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token claims")
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")

    # Block access if workspace is suspended
    if user.workspace_id:
        workspace = db.query(Workspace).filter(Workspace.id == user.workspace_id).first()
        if not workspace or not workspace.is_active:
            raise HTTPException(status_code=403, detail="Workspace is suspended")

    # Store user id in context for auditing hooks
    user_context.set(user.id)
    
    return user

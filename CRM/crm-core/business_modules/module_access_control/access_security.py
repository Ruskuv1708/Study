from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer
from starlette.requests import Request  # ✅ Use starlette for HTTPAuthCredentials
import jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from system_core.database_connector import get_db
from business_modules.module_access_control.access_models import User

# Security configuration
ALGORITHM = "HS256"
SECRET_KEY = "your-super-secret-key-change-this-in-production"
EXPIRATION_HOURS = 24

security = HTTPBearer()

def create_access_token(user_id: str, role: str, expires_delta: timedelta = None):
    """Create JWT token with role info"""
    if expires_delta is None:
        expires_delta = timedelta(hours=EXPIRATION_HOURS)
    
    expire = datetime.utcnow() + expires_delta
    
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    
    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

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
    payload = verify_token(token)
    user_id = payload.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token claims")
    
    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    
    return user
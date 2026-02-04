from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt
from system_core.config import settings

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Generates a signed JWT Token.
    Encodes the User's ID and Email into a string.
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta # <--- CHANGED
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15) # <--- CHANGED
    

    # Add expiration time to the "card"
    to_encode.update({"exp": expire})
    
    # Sign it with the Secret Key
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class WorkspaceCreateSchema(BaseModel):
    """Request body to create a new workspace"""
    workspace_name: str
    subdomain_prefix: str
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "workspace_name": "Acme Corporation",
                "subdomain_prefix": "acme",
                "admin_full_name": "John Admin",
                "admin_email": "admin@acme.com",
                "admin_password": "SecurePassword123!"
            }
        }

class WorkspaceUpdateSchema(BaseModel):
    """Update workspace settings"""
    workspace_name: Optional[str] = None
    admin_email: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[dict] = None

class WorkspaceResponseSchema(BaseModel):
    """Response when returning workspace info"""
    id: UUID
    name: str
    subdomain_prefix: str
    admin_email: str
    admin_full_name: str
    status: str
    is_active: bool
    created_at: datetime
    
    # This allows Pydantic to read data from the SQLAlchemy Object
    model_config = ConfigDict(from_attributes=True)

class WorkspaceDetailSchema(BaseModel):
    """Detailed workspace info with statistics"""
    id: UUID
    name: str
    subdomain_prefix: str
    admin_email: str
    status: str
    is_active: bool
    created_at: datetime
    user_count: int
    request_count: int
    
    model_config = ConfigDict(from_attributes=True)
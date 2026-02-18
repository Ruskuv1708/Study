from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import UUID

# 1. Workspace SCHEMAS (Company)
class WorkspaceCreateRequest(BaseModel):
    # Fix 'example' warning: Move to json_schema_extra
    name: str = Field(..., min_length=2, json_schema_extra={"example": "Apple Inc."}) 
    subdomain_prefix: str = Field(..., min_length=2, json_schema_extra={"example": "apple"})
    # This is your "Google Sheets" flexibility entry point
    # Clients can send {"industry": "tech", "size": "huge"} here.
    meta_data: Dict[str, Any] = {}

class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    subdomain_prefix: str
    is_active: bool
    model_config = ConfigDict(from_attributes=True) 



# 2. USER SCHEMAS (Employee)
class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    workspace_id: Optional[UUID] = None  # Superadmin can set this; others inherit
    department_id: Optional[UUID] = None

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    is_active: bool
    workspace_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    
    model_config = ConfigDict(from_attributes=True)

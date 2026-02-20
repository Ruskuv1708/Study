from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from uuid import UUID
from enum import Enum


class ClientStatus(str, Enum):
    NEW = "new"
    ACTIVE = "active"
    REACTIVATED = "reactivated"
    DEACTIVATED = "deactivated"
    CHANGED_FROM = "changed_from"
    CHANGED_TO = "changed_to"


class CompanyCreateSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    registration_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CompanyUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    registration_number: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CompanyResponseSchema(BaseModel):
    id: UUID
    name: str
    registration_number: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    workspace_id: UUID
    client_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ClientCreateSchema(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=120)
    last_name: str = Field(..., min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_id: Optional[UUID] = None
    notes: Optional[str] = None
    status: ClientStatus = ClientStatus.NEW
    status_company_id: Optional[UUID] = None


class ClientUpdateSchema(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=120)
    last_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_id: Optional[UUID] = None
    notes: Optional[str] = None
    status: Optional[ClientStatus] = None
    status_company_id: Optional[UUID] = None


class ClientResponseSchema(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    notes: Optional[str]
    company_id: Optional[UUID]
    company_name: Optional[str] = None
    status: ClientStatus = ClientStatus.NEW
    status_company_id: Optional[UUID] = None
    status_company_name: Optional[str] = None
    status_label: Optional[str] = None
    workspace_id: UUID
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ClientObjectCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    client_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    attributes: dict[str, str] = Field(default_factory=dict)


class ClientObjectUpdateSchema(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    client_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
    attributes: Optional[dict[str, str]] = None


class ClientObjectResponseSchema(BaseModel):
    id: UUID
    name: str
    client_id: Optional[UUID]
    client_name: Optional[str] = None
    company_id: Optional[UUID]
    company_name: Optional[str] = None
    assignment_type: str = "unassigned"
    assignment_name: Optional[str] = None
    attributes: dict[str, str] = Field(default_factory=dict)
    workspace_id: UUID
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

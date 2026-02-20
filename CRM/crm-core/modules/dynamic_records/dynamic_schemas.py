from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import UUID
from modules.workflow.workflow_enums import RequestPriority

# Defining the "Columns"
class SchemaField(BaseModel):
    key: str
    label: str
    type: str # text, number, boolean, department_select
    required: bool = False

class RequestSettings(BaseModel):
    enabled: bool = False
    department_id: Optional[UUID] = None
    department_field_key: Optional[str] = None
    priority: RequestPriority = RequestPriority.MEDIUM
    title_template: Optional[str] = None
    description_template: Optional[str] = None

# Request to create a new Template
class TemplateCreateRequest(BaseModel):
    name: str
    structure: List[SchemaField]
    request_settings: Optional[RequestSettings] = None

# Request to update a Template
class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    structure: Optional[List[SchemaField]] = None
    request_settings: Optional[RequestSettings] = None

# Request to submit Data
class RecordSubmitRequest(BaseModel):
    template_id: UUID
    data: Dict[str, Any]

class TemplateResponse(BaseModel):
    id: UUID
    name: str
    schema_structure: List[Dict]
    meta_data: Optional[Dict[str, Any]] = None
    model_config = ConfigDict(from_attributes=True)

class RecordResponse(BaseModel):
    id: UUID
    template_id: UUID
    entry_data: Dict[str, Any]
    meta_data: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class RequestAssignee(BaseModel):
    id: UUID
    full_name: str

class RequestInfo(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    department_id: UUID
    assigned_to_id: Optional[UUID] = None
    assignee: Optional[RequestAssignee] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[UUID] = None

class RecordQueueItem(BaseModel):
    record: RecordResponse
    request: Optional[RequestInfo] = None

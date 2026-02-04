from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from uuid import UUID

# Defining the "Columns"
class SchemaField(BaseModel):
    key: str
    label: str
    type: str # text, number, boolean
    required: bool = False

# Request to create a new Template
class TemplateCreateRequest(BaseModel):
    name: str
    structure: List[SchemaField]

# Request to submit Data
class RecordSubmitRequest(BaseModel):
    template_id: UUID
    data: Dict[str, Any]

class TemplateResponse(BaseModel):
    id: UUID
    name: str
    schema_structure: List[Dict]
    model_config = ConfigDict(from_attributes=True)
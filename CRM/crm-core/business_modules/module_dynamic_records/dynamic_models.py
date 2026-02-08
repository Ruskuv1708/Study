from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from system_core.base_models import CRMBasedModel

class FormTemplate(CRMBasedModel):
    __tablename__ = "dynamic_form_templates"

    name = Column(String, nullable=False)
    schema_structure = Column(JSONB, nullable=False, default=[]) 
    
    # CHANGE: access_tenants -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)


class FormRecord(CRMBasedModel):
    __tablename__ = "dynamic_form_records"

    template_id = Column(UUID(as_uuid=True), ForeignKey("dynamic_form_templates.id"), nullable=False)
    entry_data = Column(JSONB, nullable=False, default={})

    template = relationship("FormTemplate")
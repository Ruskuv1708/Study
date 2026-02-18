from sqlalchemy import Column, String, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.base_models import CRMBasedModel

class FormTemplate(CRMBasedModel):
    __tablename__ = "dynamic_form_templates"
    __table_args__ = (
        Index("ix_dynamic_form_templates_workspace_id", "workspace_id"),
    )

    name = Column(String, nullable=False)
    schema_structure = Column(JSONB, nullable=False, default=list) 
    
    # CHANGE: access_tenants -> access_workspaces
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)


class FormRecord(CRMBasedModel):
    __tablename__ = "dynamic_form_records"
    __table_args__ = (
        Index("ix_dynamic_form_records_template_created_at", "template_id", "created_at"),
        Index("ix_dynamic_form_records_template_created_by_id", "template_id", "created_by_id"),
    )

    template_id = Column(UUID(as_uuid=True), ForeignKey("dynamic_form_templates.id"), nullable=False)
    entry_data = Column(JSONB, nullable=False, default=dict)

    template = relationship("FormTemplate")

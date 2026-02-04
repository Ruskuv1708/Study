from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from system_core.base_models import CRMBasedModel

class FormTemplate(CRMBasedModel):
    """
    The Blueprint. Defines the columns.
    Example 'schema_structure': 
    [
      {"key": "price", "type": "number", "label": "Cost"},
      {"key": "notes", "type": "text", "label": "Details"}
    ]
    """
    __tablename__ = "dynamic_form_templates"

    name = Column(String, nullable=False)
    # The rules for the form are stored here
    schema_structure = Column(JSONB, nullable=False, default=[]) 
    
    # Link to workspace (Each company has their own forms)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)


class FormRecord(CRMBasedModel):
    """
    The Row in the Spreadsheet.
    Example 'entry_data': {"price": 100, "notes": "Expensive"}
    """
    __tablename__ = "dynamic_form_records"

    # Which form does this belong to?
    template_id = Column(UUID(as_uuid=True), ForeignKey("dynamic_form_templates.id"), nullable=False)
    
    # The actual data filled by the user
    entry_data = Column(JSONB, nullable=False, default={})

    # Relationships
    template = relationship("FormTemplate")
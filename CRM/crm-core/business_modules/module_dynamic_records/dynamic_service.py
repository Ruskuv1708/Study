from sqlalchemy.orm import Session
from fastapi import HTTPException
from business_modules.module_dynamic_records.dynamic_models import FormTemplate, FormRecord

class DynamicRecordService:

    @staticmethod
    def validate_input(schema: list, data: dict):
        """
        Loops through the Template Rules and checks the Data.
        Strict 1C-style validation.
        """
        for field in schema:
            key = field.get("key")
            required = field.get("required", False)
            field_type = field.get("type", "text")
            
            value = data.get(key)

            # 1. Check Required
            if required and (value is None or value == ""):
                raise HTTPException(400, detail=f"Field '{field['label']}' is required.")

            # 2. Check Type (Strictness)
            if value is not None:
                if field_type == "number" and not isinstance(value, (int, float)):
                    raise HTTPException(400, detail=f"Field '{field['label']}' must be a number.")
                
                if field_type == "boolean" and not isinstance(value, bool):
                    raise HTTPException(400, detail=f"Field '{field['label']}' must be true/false.")

        return True

    @staticmethod
    def create_template(db: Session, name: str, structure: list, workspace_id):
        # Create the Blueprint
        new_template = FormTemplate(
            name=name,
            schema_structure=structure,
            workspace_id=workspace_id
        )
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        return new_template

    @staticmethod
    def submit_record(db: Session, template_id, raw_data: dict):
        # 1. Get the Blueprint
        template = db.query(FormTemplate).filter(FormTemplate.id == template_id).first()
        if not template:
            raise HTTPException(404, detail="Form Template not found")

        # 2. Run the Validator (The strict check)
        DynamicRecordService.validate_input(template.schema_structure, raw_data)

        # 3. Save only if valid
        new_record = FormRecord(
            template_id=template_id,
            entry_data=raw_data
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        return new_record



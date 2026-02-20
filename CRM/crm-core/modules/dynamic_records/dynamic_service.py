import uuid
from tempfile import SpooledTemporaryFile

from fastapi import HTTPException
from openpyxl import Workbook
from sqlalchemy.orm import Session
from modules.dynamic_records.dynamic_models import FormTemplate, FormRecord
from modules.workflow.workflow_models import Request, Department
from modules.workflow.workflow_enums import RequestPriority, RequestStatus
from modules.workflow.workflow_service import WorkflowService
from modules.access_control.access_permissions import PermissionService
from core.config import settings

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

                if field_type == "department_select":
                    if not isinstance(value, str) or not value.strip():
                        raise HTTPException(400, detail=f"Field '{field['label']}' must be a department ID.")

        return True

    @staticmethod
    def create_template(db: Session, name: str, structure: list, workspace_id, request_settings: dict | None = None):
        # Create the Blueprint
        meta = {}
        if request_settings is not None:
            meta["request_settings"] = request_settings
        new_template = FormTemplate(
            name=name,
            schema_structure=structure,
            workspace_id=workspace_id,
            meta_data=meta or None
        )
        db.add(new_template)
        db.commit()
        db.refresh(new_template)
        return new_template

    @staticmethod
    def submit_record(db: Session, template_id, raw_data: dict, workspace_id, current_user):
        # 1. Get the Blueprint
        template = db.query(FormTemplate).filter(
            FormTemplate.id == template_id,
            FormTemplate.workspace_id == workspace_id
        ).first()
        if not template:
            raise HTTPException(404, detail="Form Template not found")

        # 2. Run the Validator (The strict check)
        DynamicRecordService.validate_input(template.schema_structure, raw_data)

        # 3. Create Request if enabled
        req = None
        request_settings = (template.meta_data or {}).get("request_settings") if template.meta_data else None
        if request_settings and request_settings.get("enabled"):
            PermissionService.require_permission(current_user, "create_request")
            department_id = request_settings.get("department_id")
            department_field_key = request_settings.get("department_field_key")
            if department_field_key and raw_data.get(department_field_key):
                department_id = raw_data.get(department_field_key)
            if not department_id:
                raise HTTPException(400, detail="Template request settings missing department_id")
            try:
                department_uuid = department_id if hasattr(department_id, "hex") else uuid.UUID(str(department_id))
            except Exception:
                raise HTTPException(400, detail="Invalid department_id in request settings or form data")
            dept = db.query(Department).filter(
                Department.id == department_uuid,
                Department.workspace_id == workspace_id
            ).first()
            if not dept:
                raise HTTPException(404, detail="Department not found")
            priority_value = request_settings.get("priority") or RequestPriority.MEDIUM.value
            try:
                priority = RequestPriority(priority_value)
            except Exception:
                priority = RequestPriority.MEDIUM

            title_template = request_settings.get("title_template") or template.name
            description_template = request_settings.get("description_template")
            title = DynamicRecordService._render_template(title_template, raw_data)
            if description_template:
                description = DynamicRecordService._render_template(description_template, raw_data)
            else:
                description = DynamicRecordService._build_default_description(template.schema_structure, raw_data)

            req = Request(
                title=title,
                description=description,
                priority=priority,
                department_id=department_uuid,
                workspace_id=workspace_id,
                status=RequestStatus.NEW,
                created_by_id=current_user.id
            )
            db.add(req)
            db.flush()

        # 4. Save only if valid
        new_record = FormRecord(
            template_id=template_id,
            entry_data=raw_data,
            meta_data={}
        )
        db.add(new_record)
        db.flush()
        if req:
            new_record.meta_data = {
                **(new_record.meta_data or {}),
                "request_id": str(req.id)
            }
            req.meta_data = {
                **(req.meta_data or {}),
                "template_id": str(template.id),
                "record_id": str(new_record.id)
            }
        db.commit()
        db.refresh(new_record)
        return new_record

    @staticmethod
    def list_templates(db: Session, workspace_id, skip: int = 0, limit: int = settings.DEFAULT_PAGE_SIZE):
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        skip = max(skip, 0)
        return db.query(FormTemplate).filter(
            FormTemplate.workspace_id == workspace_id
        ).order_by(FormTemplate.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_template(db: Session, template_id, workspace_id):
        template = db.query(FormTemplate).filter(
            FormTemplate.id == template_id,
            FormTemplate.workspace_id == workspace_id
        ).first()
        if not template:
            raise HTTPException(404, detail="Form Template not found")
        return template

    @staticmethod
    def update_template(db: Session, template_id, workspace_id, name=None, structure=None):
        template = DynamicRecordService.get_template(db, template_id, workspace_id)
        if name is not None:
            template.name = name
        if structure is not None:
            template.schema_structure = structure
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def update_template_settings(db: Session, template_id, workspace_id, request_settings: dict | None = None):
        template = DynamicRecordService.get_template(db, template_id, workspace_id)
        if request_settings is not None:
            meta = template.meta_data or {}
            meta["request_settings"] = request_settings
            template.meta_data = meta
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def delete_template(db: Session, template_id, workspace_id):
        template = DynamicRecordService.get_template(db, template_id, workspace_id)
        existing = db.query(FormRecord).filter(FormRecord.template_id == template.id).first()
        if existing:
            raise HTTPException(400, detail="Cannot delete template with existing records")
        db.delete(template)
        db.commit()
        return {"message": "Template deleted"}

    @staticmethod
    def list_records(db: Session, template_id, workspace_id, owner_id: str | None = None, skip: int = 0, limit: int = settings.DEFAULT_PAGE_SIZE):
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        skip = max(skip, 0)
        query = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.template_id == template_id,
            FormTemplate.workspace_id == workspace_id
        )
        if owner_id:
            query = query.filter(FormRecord.created_by_id == owner_id)
        return query.order_by(FormRecord.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def list_records_with_requests(db: Session, template_id, workspace_id, owner_id: str | None = None, skip: int = 0, limit: int = settings.DEFAULT_PAGE_SIZE):
        records = DynamicRecordService.list_records(db, template_id, workspace_id, owner_id, skip, limit)
        request_ids = set()
        for record in records:
            meta = record.meta_data or {}
            request_id = meta.get("request_id")
            if request_id:
                try:
                    request_ids.add(uuid.UUID(str(request_id)))
                except Exception:
                    continue

        request_map = {}
        if request_ids:
            requests = db.query(Request).filter(Request.id.in_(list(request_ids))).all()
            request_map = {str(req.id): req for req in requests}

        items = []
        for record in records:
            request_info = None
            meta = record.meta_data or {}
            request_id = meta.get("request_id")
            if request_id:
                req = request_map.get(str(request_id))
                if req:
                    request_info = WorkflowService._serialize_request(req)
            items.append({"record": record, "request": request_info})
        return items

    @staticmethod
    def delete_record(db: Session, record_id, workspace_id, current_user):
        record = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.id == record_id,
            FormTemplate.workspace_id == workspace_id
        ).first()
        if not record:
            raise HTTPException(404, detail="Form Record not found")

        request_id = (record.meta_data or {}).get("request_id")
        if request_id:
            try:
                request_uuid = request_id if hasattr(request_id, "hex") else uuid.UUID(str(request_id))
                WorkflowService.delete_request(db, request_uuid, workspace_id, current_user)
            except HTTPException as exc:
                if exc.status_code != 404:
                    raise
            except Exception:
                raise HTTPException(400, detail="Unable to delete linked request")

        db.delete(record)
        db.commit()
        return {"message": "Record deleted"}

    @staticmethod
    def get_record_by_request_id(db: Session, request_id, workspace_id, current_user):
        req = WorkflowService.get_request_by_id(db, request_id, workspace_id, current_user)
        record_id = (req.meta_data or {}).get("record_id")
        if not record_id:
            raise HTTPException(404, detail="No record linked to this request")
        try:
            record_uuid = record_id if hasattr(record_id, "hex") else uuid.UUID(str(record_id))
        except Exception:
            raise HTTPException(400, detail="Invalid linked record_id")
        record = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.id == record_uuid,
            FormTemplate.workspace_id == workspace_id
        ).first()
        if not record:
            raise HTTPException(404, detail="Linked record not found")
        return record

    @staticmethod
    def get_record(db: Session, record_id, workspace_id, owner_id: str | None = None):
        query = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.id == record_id,
            FormTemplate.workspace_id == workspace_id
        )
        if owner_id:
            query = query.filter(FormRecord.created_by_id == owner_id)
        record = query.first()
        if not record:
            raise HTTPException(404, detail="Form Record not found")
        return record

    @staticmethod
    def export_records_excel(db: Session, template_id, workspace_id, owner_id: str | None = None):
        template = DynamicRecordService.get_template(db, template_id, workspace_id)
        count_query = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.template_id == template_id,
            FormTemplate.workspace_id == workspace_id
        )
        if owner_id:
            count_query = count_query.filter(FormRecord.created_by_id == owner_id)
        total = count_query.count()
        if total > settings.MAX_EXPORT_ROWS:
            raise HTTPException(
                status_code=413,
                detail=f"Export exceeds max row limit ({settings.MAX_EXPORT_ROWS})"
            )

        # Build ordered columns based on template structure
        columns = []
        for field in template.schema_structure:
            key = field.get("key")
            label = field.get("label") or key
            if key:
                columns.append((key, label))

        workbook = Workbook(write_only=True)
        sheet_name = (template.name or "Template")[:31]
        sheet = workbook.create_sheet(title=sheet_name)
        sheet.append([label for _, label in columns])

        records_query = db.query(FormRecord).join(
            FormTemplate, FormRecord.template_id == FormTemplate.id
        ).filter(
            FormRecord.template_id == template_id,
            FormTemplate.workspace_id == workspace_id
        )
        if owner_id:
            records_query = records_query.filter(FormRecord.created_by_id == owner_id)
        records_query = records_query.order_by(FormRecord.created_at.desc()).limit(settings.MAX_EXPORT_ROWS)

        for record in records_query.yield_per(1000):
            row = []
            for key, _ in columns:
                row.append(record.entry_data.get(key))
            sheet.append(row)

        output = SpooledTemporaryFile(max_size=settings.EXPORT_SPOOL_MAX_MB * 1024 * 1024)
        workbook.save(output)
        output.seek(0)
        return output, (template.name or "template")

    @staticmethod
    def _render_template(text: str, data: dict):
        rendered = text
        for key, value in data.items():
            rendered = rendered.replace(f"{{{key}}}", str(value))
        return rendered

    @staticmethod
    def _build_default_description(schema: list, data: dict):
        lines = []
        for field in schema:
            key = field.get("key")
            label = field.get("label") or key
            if not key:
                continue
            value = data.get(key)
            lines.append(f"{label}: {value if value is not None else ''}")
        return "\n".join(lines)

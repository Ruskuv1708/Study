from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from core.database_connector import get_db
from core.workspace_resolver import resolve_workspace_id
from core.config import settings
from modules.dynamic_records.dynamic_service import DynamicRecordService
from modules.dynamic_records.dynamic_schemas import (
    TemplateCreateRequest, TemplateUpdateRequest, RecordSubmitRequest, TemplateResponse, RecordResponse, RequestSettings, RecordQueueItem
)
# Protect these routes! Only logged in users.
from modules.access_control.access_security import get_current_user
from modules.access_control.access_enums import UserRole
from modules.access_control.access_permissions import PermissionService

router = APIRouter(prefix="/forms", tags=["Dynamic Forms"])

def _serialize_request_settings(settings: Optional[RequestSettings]):
    if settings is None:
        return None
    return {
        "enabled": bool(settings.enabled),
        "department_id": str(settings.department_id) if settings.department_id else None,
        "priority": settings.priority.value if hasattr(settings.priority, "value") else str(settings.priority),
        "title_template": settings.title_template,
        "description_template": settings.description_template
    }

@router.post("/template", response_model=TemplateResponse)
def create_form_structure(
    form_data: TemplateCreateRequest,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Manager creates a new Form Blueprint """
    PermissionService.require_permission(current_user, "create_form_template")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    # Logic note: In real life, check if current_user.is_admin here!
    request_settings = _serialize_request_settings(form_data.request_settings)
    return DynamicRecordService.create_template(
        db, form_data.name, [x.model_dump() for x in form_data.structure], workspace_id, request_settings
    )

@router.get("/templates", response_model=List[TemplateResponse])
def list_form_templates(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    PermissionService.require_permission(current_user, "view_form_templates")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.list_templates(db, workspace_id, skip, limit)

@router.get("/templates/{template_id}", response_model=TemplateResponse)
def get_form_template(
    template_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "view_form_templates")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.get_template(db, template_id, workspace_id)

@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_form_template(
    template_id: UUID,
    payload: TemplateUpdateRequest,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "edit_form_template")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    structure = [x.model_dump() for x in payload.structure] if payload.structure is not None else None
    template = DynamicRecordService.update_template(db, template_id, workspace_id, payload.name, structure)
    if payload.request_settings is not None:
        request_settings = _serialize_request_settings(payload.request_settings)
        template = DynamicRecordService.update_template_settings(db, template_id, workspace_id, request_settings)
    return template

@router.delete("/templates/{template_id}")
def delete_form_template(
    template_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "delete_form_template")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.delete_template(db, template_id, workspace_id)

@router.post("/submit")
def fill_out_form(
    submission: RecordSubmitRequest,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Employee fills out the form """
    PermissionService.require_permission(current_user, "submit_form_record")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.submit_record(
        db, submission.template_id, submission.data, workspace_id, current_user
    )

@router.get("/records", response_model=List[RecordResponse])
def list_form_records(
    template_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_form_records")
        owner_id = current_user.id
    else:
        PermissionService.require_permission(current_user, "view_form_records")
        owner_id = None
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.list_records(db, template_id, workspace_id, owner_id, skip, limit)

@router.get("/records/queue", response_model=List[RecordQueueItem])
def list_form_records_queue(
    template_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_form_records")
        owner_id = current_user.id
    else:
        PermissionService.require_permission(current_user, "view_form_records")
        owner_id = None
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.list_records_with_requests(db, template_id, workspace_id, owner_id, skip, limit)

@router.get("/records/by-request/{request_id}", response_model=RecordResponse)
def get_record_by_request(
    request_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.get_record_by_request_id(db, request_id, workspace_id, current_user)

@router.get("/records/excel")
def export_form_records_excel(
    template_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_form_records")
        owner_id = current_user.id
    else:
        PermissionService.require_permission(current_user, "view_form_records")
        owner_id = None
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    file_stream, safe_name = DynamicRecordService.export_records_excel(
        db, template_id, workspace_id, owner_id
    )
    headers = {
        "Content-Disposition": f'attachment; filename="{safe_name}_records.xlsx"'
    }
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@router.get("/records/{record_id}", response_model=RecordResponse)
def get_form_record(
    record_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role in (UserRole.USER, UserRole.VIEWER):
        PermissionService.require_permission(current_user, "view_own_form_records")
        owner_id = current_user.id
    else:
        PermissionService.require_permission(current_user, "view_form_records")
        owner_id = None
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.get_record(db, record_id, workspace_id, owner_id)


@router.delete("/records/{record_id}")
def delete_form_record(
    record_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    PermissionService.require_permission(current_user, "delete_form_record")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    return DynamicRecordService.delete_record(db, record_id, workspace_id, current_user)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from system_core.database_connector import get_db
from system_core.context import get_current_workspace_id
from business_modules.module_dynamic_records.dynamic_service import DynamicRecordService
from business_modules.module_dynamic_records.dynamic_schemas import (
    TemplateCreateRequest, RecordSubmitRequest, TemplateResponse
)
# Protect these routes! Only logged in users.
from business_modules.module_access_control.access_security import get_current_user

router = APIRouter(prefix="/forms", tags=["Dynamic Forms"])

@router.post("/template", response_model=TemplateResponse)
def create_form_structure(
    form_data: TemplateCreateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Manager creates a new Form Blueprint """
    workspace_id = get_current_workspace_id()
    # Logic note: In real life, check if current_user.is_admin here!
    return DynamicRecordService.create_template(
        db, form_data.name, [x.dict() for x in form_data.structure], workspace_id
    )

@router.post("/submit")
def fill_out_form(
    submission: RecordSubmitRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Employee fills out the form """
    return DynamicRecordService.submit_record(
        db, submission.template_id, submission.data
    )
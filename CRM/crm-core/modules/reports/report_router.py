from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from core.database_connector import get_db
from core.workspace_resolver import resolve_workspace_id
from modules.access_control.access_security import get_current_user
from modules.access_control.access_permissions import PermissionService
from modules.reports.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reporting Engine"])

@router.get("/requests/excel")
def download_requests_report(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Download all requests as .xlsx """
    PermissionService.require_permission(current_user, "view_reports")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    
    # 1. Generate the Excel binary data
    file_stream = ReportService.generate_requests_excel(db, workspace_id)
    
    # 2. Return as a Stream
    # Headers tell the browser this is an attachment to download
    headers = {
        "Content-Disposition": 'attachment; filename="requests_report.xlsx"'
    }
    
    return StreamingResponse(
        file_stream, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

@router.get("/users/excel")
def download_users_report(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Download employee list """
    PermissionService.require_permission(current_user, "view_reports")
    workspace_id = resolve_workspace_id(current_user, workspace_id)
    file_stream = ReportService.generate_users_excel(db, workspace_id)
    
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="employees.xlsx"'}
    )
    

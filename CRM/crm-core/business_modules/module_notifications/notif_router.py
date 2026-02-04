from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from system_core.database_connector import get_db
from business_modules.module_access_control.access_security import get_current_user
from business_modules.module_notifications.notif_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["System Notifications"])

@router.get("/my-inbox")
def check_inbox(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ Used by Frontend to show the list of unread messages """
    return NotificationService.get_my_unread(db, current_user.id)

@router.post("/{notif_id}/read")
def mark_read(
    notif_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """ User clicked the message """
    return NotificationService.mark_as_read(db, notif_id, current_user.id)
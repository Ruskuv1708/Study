from sqlalchemy.orm import Session
from modules.notifications.notif_models import Notification
from core.config import settings

class NotificationService:

    @staticmethod
    def send_notification(db: Session, user_id, title: str, message: str, link: str, workspace_id):
        """
        Creates a new alert in the database.
        """
        new_notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            target_link=link,
            workspace_id=workspace_id
        )
        db.add(new_notif)
        db.commit()
        return new_notif

    @staticmethod


    def get_my_unread(db: Session, user_id, limit: int = settings.DEFAULT_PAGE_SIZE):
        """
        Get all active alerts for the "Bell Icon"
        """
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).order_by(Notification.created_at.desc()).limit(limit).all()

    @staticmethod
    def mark_as_read(db: Session, notif_id, user_id):
        """
        User clicked the alert. Turn off the red dot.
        """
        notif = db.query(Notification).filter(
            Notification.id == notif_id, 
            Notification.user_id == user_id
        ).first()
        
        if notif:
            notif.is_read = True
            db.commit()
        return {"status": "ok"}

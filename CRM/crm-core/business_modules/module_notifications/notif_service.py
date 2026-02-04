from sqlalchemy.orm import Session
from business_modules.module_notifications.notif_models import Notification

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


    def get_my_unread(db: Session, user_id):
        """
        Get all active alerts for the "Bell Icon"
        """
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).order_by(Notification.created_at.desc()).all()

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
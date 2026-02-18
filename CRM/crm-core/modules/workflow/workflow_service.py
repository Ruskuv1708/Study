from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException
from typing import Optional
from uuid import UUID

from modules.workflow.workflow_models import Department, Request
from modules.workflow.workflow_enums import RequestPriority, RequestStatus
from modules.access_control.access_models import User
from modules.access_control.access_enums import UserRole
from modules.file_storage.file_service import FileStorageService
from sqlalchemy import or_
from datetime import datetime, timezone
from core.config import settings

class WorkflowService:
    @staticmethod
    def _serialize_request(req: Request):
        return {
            "id": str(req.id),
            "title": req.title,
            "description": req.description,
            "status": req.status.value,
            "priority": req.priority.value,
            "department_id": str(req.department_id),
            "assigned_to_id": str(req.assigned_to_id) if req.assigned_to_id else None,
            "assignee": {
                "id": str(req.assignee.id),
                "full_name": req.assignee.full_name
            } if req.assignee else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
            "created_by_id": str(req.created_by_id) if req.created_by_id else None,
            "meta_data": req.meta_data
        }

    # --- DEPARTMENT LOGIC ---
    @staticmethod
    def create_department(db: Session, name: str, description: str, workspace_id: UUID):
        """ Create a new bucket for work (e.g., 'IT Support') """
        dept = Department(
            name=name,
            description=description,
            workspace_id=workspace_id
        )
        db.add(dept)
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def list_departments(db: Session, workspace_id: UUID, skip: int = 0, limit: int = settings.DEFAULT_PAGE_SIZE):
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        skip = max(skip, 0)
        return db.query(Department)\
            .filter(Department.workspace_id == workspace_id)\
            .offset(skip)\
            .limit(limit)\
            .all()
    
    @staticmethod
    def update_department(db: Session, department_id: UUID, workspace_id: UUID, name: Optional[str], description: Optional[str]):
        dept = db.query(Department).filter(
            Department.id == department_id,
            Department.workspace_id == workspace_id
        ).first()
        if not dept:
            raise HTTPException(404, detail="Department not found")
        if name is not None:
            dept.name = name
        if description is not None:
            dept.description = description
        db.commit()
        db.refresh(dept)
        return dept

    @staticmethod
    def delete_department(db: Session, department_id: UUID, workspace_id: UUID):
        dept = db.query(Department).filter(
            Department.id == department_id,
            Department.workspace_id == workspace_id
        ).first()
        if not dept:
            raise HTTPException(404, detail="Department not found")
        
        # Prevent deletion if requests or users are still linked
        has_requests = db.query(Request.id).filter(Request.department_id == department_id).first() is not None
        if has_requests:
            raise HTTPException(400, detail="Cannot delete department with existing requests")

        has_users = db.query(User.id).filter(User.department_id == department_id).first() is not None
        if has_users:
            raise HTTPException(400, detail="Cannot delete department with assigned users")

        db.delete(dept)
        db.commit()
        return {"message": "Department deleted"}

    # --- REQUEST LOGIC ---
    @staticmethod
    def create_request(db: Session, title: str, description: str, priority: str, department_id: UUID, workspace_id: UUID, current_user):
        """ Create a ticket inside a specific department """
        # Verify Department exists and belongs to this workspace
        dept = db.query(Department).filter(Department.id == department_id, Department.workspace_id == workspace_id).first()
        if not dept:
            raise HTTPException(404, detail="Department not found")

        req = Request(
            title=title,
            description=description,
            priority=priority,
            department_id=department_id,
            workspace_id=workspace_id,
            status=RequestStatus.NEW,
            created_by_id=current_user.id
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return WorkflowService._serialize_request(req)

    @staticmethod
    def assign_request(db: Session, request_id: UUID, assignee_id: UUID, workspace_id: Optional[UUID], current_user):
        """ Assign a user to a request """
        # Verify Request exists
        query = db.query(Request).options(joinedload(Request.assignee)).filter(Request.id == request_id)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)
        req = query.first()
        if not req:
            raise HTTPException(404, detail="Request not found")

        # Verify User exists
        user_query = db.query(User).filter(User.id == assignee_id)
        if workspace_id:
            user_query = user_query.filter(User.workspace_id == workspace_id)
        user = user_query.first()
        if not user:
            raise HTTPException(404, detail="Assignee not found")

        # Managers can only assign to ordinary users in their department
        if current_user.role == UserRole.MANAGER:
            if user.role != UserRole.USER:
                raise HTTPException(403, detail="Managers can only assign requests to ordinary users")
            if current_user.department_id is None or user.department_id != current_user.department_id:
                raise HTTPException(403, detail="Managers can only assign within their department")

        if req.assigned_to_id and req.assigned_to_id != assignee_id:
            raise HTTPException(400, detail="Request already assigned")
        req.assigned_to_id = assignee_id
        req.status = RequestStatus.ASSIGNED # Change status automatically
        
        db.commit()
        db.refresh(req)
        # TODO: Trigger Notification here (Integration point)
        return WorkflowService._serialize_request(req)

    @staticmethod
    def unassign_request(db: Session, request_id: UUID, workspace_id: Optional[UUID], current_user):
        """ Remove assignee from a request """
        query = db.query(Request).filter(Request.id == request_id)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)
        req = query.first()
        if not req:
            raise HTTPException(404, detail="Request not found")

        if current_user.role == UserRole.MANAGER:
            if not current_user.department_id or req.department_id != current_user.department_id:
                raise HTTPException(403, detail="Managers can only unassign requests in their department")

        req.assigned_to_id = None
        req.status = RequestStatus.NEW
        db.commit()
        db.refresh(req)
        return WorkflowService._serialize_request(req)

    @staticmethod
    def delete_request(db: Session, request_id: UUID, workspace_id: Optional[UUID], current_user):
        query = db.query(Request).filter(Request.id == request_id)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)
        req = query.first()
        if not req:
            raise HTTPException(404, detail="Request not found")

        if current_user.role == UserRole.MANAGER:
            # Managers can delete requests created by themselves or within their department
            if req.created_by_id == current_user.id:
                pass
            elif not current_user.department_id or req.department_id != current_user.department_id:
                raise HTTPException(403, detail="Managers can only delete requests in their department or their own requests")
        elif current_user.role in (UserRole.USER, UserRole.VIEWER):
            if req.created_by_id != current_user.id and req.assigned_to_id != current_user.id:
                raise HTTPException(403, detail="Users can only delete their own requests")

        # Cleanup file attachments linked to this request (best-effort)
        FileStorageService.delete_files_for_entity(db, req.workspace_id, "request", req.id)

        db.delete(req)
        db.commit()
        return {"message": "Request deleted"}

    @staticmethod
    def list_requests(
        db: Session,
        workspace_id: Optional[UUID],
        current_user,
        department_id: Optional[UUID] = None,
        assignee_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = settings.DEFAULT_PAGE_SIZE
    ):
        """ Flexible Filter: Get requests by Dept, by User, or All """
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        skip = max(skip, 0)

        query = db.query(Request).filter(Request.status != RequestStatus.DONE)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)

        if department_id:
            query = query.filter(Request.department_id == department_id)

        if assignee_id:
            query = query.filter(Request.assigned_to_id == assignee_id)

        if current_user.role == UserRole.MANAGER:
            owned_filters = or_(
                Request.assigned_to_id == current_user.id,
                Request.created_by_id == current_user.id,
            )
            if current_user.department_id:
                query = query.filter(or_(Request.department_id == current_user.department_id, owned_filters))
            else:
                query = query.filter(owned_filters)
        elif current_user.role in (UserRole.USER, UserRole.VIEWER):
            owned_filters = or_(
                Request.assigned_to_id == current_user.id,
                Request.created_by_id == current_user.id,
            )
            query = query.filter(owned_filters)

        requests = query.options(joinedload(Request.assignee))\
            .order_by(Request.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        return [WorkflowService._serialize_request(req) for req in requests]

    @staticmethod
    def list_done_requests(
        db: Session,
        workspace_id: Optional[UUID],
        current_user,
        department_id: Optional[UUID] = None,
        assignee_id: Optional[UUID] = None,
        skip: int = 0,
        limit: int = settings.DEFAULT_PAGE_SIZE
    ):
        """ History of done requests """
        limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
        skip = max(skip, 0)

        query = db.query(Request).filter(Request.status == RequestStatus.DONE)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)

        if department_id:
            query = query.filter(Request.department_id == department_id)

        if assignee_id:
            query = query.filter(Request.assigned_to_id == assignee_id)

        if current_user.role == UserRole.MANAGER:
            owned_filters = or_(
                Request.assigned_to_id == current_user.id,
                Request.created_by_id == current_user.id,
            )
            if current_user.department_id:
                query = query.filter(or_(Request.department_id == current_user.department_id, owned_filters))
            else:
                query = query.filter(owned_filters)
        elif current_user.role in (UserRole.USER, UserRole.VIEWER):
            owned_filters = or_(
                Request.assigned_to_id == current_user.id,
                Request.created_by_id == current_user.id,
            )
            query = query.filter(owned_filters)

        requests = query.options(joinedload(Request.assignee))\
            .order_by(Request.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        return [WorkflowService._serialize_request(req) for req in requests]

    @staticmethod
    def get_request_by_id(db: Session, request_id: UUID, workspace_id: Optional[UUID], current_user):
        """ Fetch detailed info for a single request """
        query = db.query(Request).filter(Request.id == request_id)
        if workspace_id:
            query = query.filter(Request.workspace_id == workspace_id)
        req = query.first()
        if not req:
            raise HTTPException(404, detail="Request not found")
        
        # Role-based access check
        if current_user.role == UserRole.MANAGER:
            if not current_user.department_id or req.department_id != current_user.department_id:
                raise HTTPException(403, detail="Access denied")
        elif current_user.role in (UserRole.USER, UserRole.VIEWER):
            if req.assigned_to_id != current_user.id and req.created_by_id != current_user.id:
                raise HTTPException(403, detail="Access denied")
        return req

    @staticmethod
    def update_request_status(db: Session, request_id: UUID, workspace_id: Optional[UUID], new_status: str, current_user):
        req = db.query(Request).filter(Request.id == request_id)
        if workspace_id:
            req = req.filter(Request.workspace_id == workspace_id)
        request_obj = req.first()
        if not request_obj:
            raise HTTPException(404, detail="Request not found")
        # Role restrictions
        if current_user.role == UserRole.MANAGER:
            if not current_user.department_id or request_obj.department_id != current_user.department_id:
                raise HTTPException(403, detail="Managers can only update requests inside their department")
        elif current_user.role in (UserRole.USER, UserRole.VIEWER):
            if request_obj.created_by_id != current_user.id and request_obj.assigned_to_id != current_user.id:
                raise HTTPException(403, detail="Users can only update their own requests")

        normalized_status = new_status.lower()
        if normalized_status not in RequestStatus._value2member_map_:
            raise HTTPException(400, detail="Invalid status")
        request_obj.status = RequestStatus(normalized_status)
        meta = request_obj.meta_data or {}
        if request_obj.status == RequestStatus.DONE:
            meta["done_at"] = datetime.now(timezone.utc).isoformat()
        else:
            meta.pop("done_at", None)
        request_obj.meta_data = meta

        db.commit()
        db.refresh(request_obj)
        return request_obj

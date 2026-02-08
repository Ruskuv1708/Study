from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional
from uuid import UUID

from business_modules.module_workflow.workflow_models import Department, Request, RequestStatus
from business_modules.module_access_control.access_models import User
from business_modules.module_access_control.access_enums import UserRole
from sqlalchemy import or_

class WorkflowService:

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
    def list_departments(db: Session, workspace_id: UUID):
        return db.query(Department).filter(Department.workspace_id == workspace_id).all()
    
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
        return req

    @staticmethod
    def assign_request(db: Session, request_id: UUID, assignee_id: UUID, workspace_id: UUID, current_user):
        """ Assign a user to a request """
        # Verify Request exists
        req = db.query(Request).filter(Request.id == request_id, Request.workspace_id == workspace_id).first()
        if not req:
            raise HTTPException(404, detail="Request not found")

        # Verify User exists
        user = db.query(User).filter(User.id == assignee_id, User.workspace_id == workspace_id).first()
        if not user:
            raise HTTPException(404, detail="Assignee not found")

        # Managers can only assign to ordinary users in their department
        if current_user.role == UserRole.MANAGER:
            if user.role != UserRole.USER:
                raise HTTPException(403, detail="Managers can only assign requests to ordinary users")
            if current_user.department_id is None or user.department_id != current_user.department_id:
                raise HTTPException(403, detail="Managers can only assign within their department")

        req.assigned_to_id = assignee_id
        req.status = RequestStatus.ASSIGNED # Change status automatically
        
        db.commit()
        db.refresh(req)
        
        # TODO: Trigger Notification here (Integration point)
        
        return req

    @staticmethod
    def list_requests(db: Session, workspace_id: UUID, current_user, department_id: Optional[UUID] = None, assignee_id: Optional[UUID] = None):
        """ Flexible Filter: Get requests by Dept, by User, or All """
        query = db.query(Request).filter(Request.workspace_id == workspace_id)
        
        if department_id:
            query = query.filter(Request.department_id == department_id)
        
        if assignee_id:
            query = query.filter(Request.assigned_to_id == assignee_id)

        # Role-based visibility
        if current_user.role == UserRole.MANAGER:
            if not current_user.department_id:
                return []
            query = query.filter(Request.department_id == current_user.department_id)
        elif current_user.role == UserRole.USER:
            query = query.filter(
                or_(
                    Request.assigned_to_id == current_user.id,
                    Request.created_by_id == current_user.id,
                )
            )

        return query.all()

    @staticmethod
    def get_request_by_id(db: Session, request_id: UUID, workspace_id: UUID, current_user):
        """ Fetch detailed info for a single request """
        req = db.query(Request).filter(Request.id == request_id, Request.workspace_id == workspace_id).first()
        if not req:
            raise HTTPException(404, detail="Request not found")
        
        # Role-based access check
        if current_user.role == UserRole.MANAGER:
            if not current_user.department_id or req.department_id != current_user.department_id:
                raise HTTPException(403, detail="Access denied")
        elif current_user.role == UserRole.USER:
            if req.assigned_to_id != current_user.id and req.created_by_id != current_user.id:
                raise HTTPException(403, detail="Access denied")
        return req

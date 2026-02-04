from sqlalchemy.orm import Session
from fastapi import HTTPException
from typing import Optional
from uuid import UUID

from business_modules.module_workflow.workflow_models import Department, Request, RequestStatus
from business_modules.module_access_control.access_models import User

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

    # --- REQUEST LOGIC ---
    @staticmethod
    def create_request(db: Session, title: str, description: str, priority: str, department_id: UUID, workspace_id: UUID):
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
            status=RequestStatus.NEW
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def assign_request(db: Session, request_id: UUID, assignee_id: UUID, workspace_id: UUID):
        """ Assign a user to a request """
        # Verify Request exists
        req = db.query(Request).filter(Request.id == request_id, Request.workspace_id == workspace_id).first()
        if not req:
            raise HTTPException(404, detail="Request not found")

        # Verify User exists
        user = db.query(User).filter(User.id == assignee_id, User.workspace_id == workspace_id).first()
        if not user:
            raise HTTPException(404, detail="Assignee not found")

        req.assigned_to_id = assignee_id
        req.status = RequestStatus.ASSIGNED # Change status automatically
        
        db.commit()
        db.refresh(req)
        
        # TODO: Trigger Notification here (Integration point)
        
        return req

    @staticmethod
    def list_requests(db: Session, workspace_id: UUID, department_id: Optional[UUID] = None, assignee_id: Optional[UUID] = None):
        """ Flexible Filter: Get requests by Dept, by User, or All """
        query = db.query(Request).filter(Request.workspace_id == workspace_id)
        
        if department_id:
            query = query.filter(Request.department_id == department_id)
        
        if assignee_id:
            query = query.filter(Request.assigned_to_id == assignee_id)
            
        return query.all()

    @staticmethod
    def get_request_by_id(db: Session, request_id: UUID, workspace_id: UUID):
        """ Fetch detailed info for a single request """
        req = db.query(Request).filter(Request.id == request_id, Request.workspace_id == workspace_id).first()
        if not req:
            raise HTTPException(404, detail="Request not found")
        return req
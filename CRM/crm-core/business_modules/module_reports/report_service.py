import pandas as pd
import io
from sqlalchemy.orm import Session
from datetime import datetime

# Import the models we want to report on
from business_modules.module_workflow.workflow_models import Request
from business_modules.module_access_control.access_models import User

class ReportService:

    @staticmethod
    def generate_requests_excel(db: Session, workspace_id):
        """
        Generates an Excel file containing all Requests for this company.
        """
        # 1. Fetch Data (SQLAlchemy)
        # We join with User to get the actual name of the assignee
        query = db.query(
            Request.title,
            Request.status,
            Request.priority,
            Request.created_at,
            User.full_name.label("assignee_name")
        ).outerjoin(User, Request.assigned_to_id == User.id)\
         .filter(Request.workspace_id == workspace_id)

        results = query.all()

        # 2. Convert to Dictionary List
        data_list = []
        for row in results:
            data_list.append({
                "Title": row.title,
                "Status": row.status.value, # Convert Enum to string
                "Priority": row.priority.value,
                "Created Date": row.created_at.strftime("%Y-%m-%d %H:%M"),
                "Assigned To": row.assignee_name if row.assignee_name else "Unassigned"
            })

        # 3. Create DataFrame (The Table in Memory)
        df = pd.DataFrame(data_list)

        # 4. Write to Excel Buffer (In-Memory File)
        # We use BytesIO so we don't clog the server hard drive with temp files.
        output = io.BytesIO()
        
        # We use the 'xlsxwriter' or default engine
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Requests_Export")
        
        # Reset cursor to the beginning of the file
        output.seek(0)
        
        return output

    @staticmethod
    def generate_users_excel(db: Session, workspace_id):
        """
        Another example: Export List of Employees
        """
        users = db.query(User).filter(User.workspace_id == workspace_id).all()
        
        data = [{"Name": u.full_name, "Email": u.email, "Admin": u.is_admin} for u in users]
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Employees")
        output.seek(0)
        
        return output

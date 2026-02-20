from modules.access_control.access_enums import UserRole
from fastapi import HTTPException

class PermissionService:
    """
    Centralized permission checking with security logging
    """

    # Define what each role can do
    PERMISSIONS = {
        UserRole.SUPERADMIN: [
            "create_user",
            "edit_user",
            "delete_user",
            "manage_roles",
            "assign_departments",
            "create_workspace",
            "edit_workspace",
            "delete_workspace",
            "view_workspace_stats",
            "suspend_workspace",
            "create_department",
            "edit_department",
            "delete_department",
            "manage_department_ranks",
            "assign_user_rank",
            "view_departments",
            "view_department_users",
            "assign_request",
            "create_request",
            "edit_request",
            "delete_request",
            "view_all_requests",
            "view_all_users",
            "view_reports",
            "access_superadmin_panel",  # ⚠️ SUPERADMIN ONLY
            "create_form_template",
            "edit_form_template",
            "delete_form_template",
            "view_form_templates",
            "submit_form_record",
            "view_form_records",
            "view_own_form_records",
            "delete_form_record",
            "upload_files",
            "download_files",
            "delete_files",
            "create_company",
            "edit_company",
            "delete_company",
            "view_companies",
            "create_client",
            "edit_client",
            "delete_client",
            "view_clients",
        ],
        UserRole.SYSTEM_ADMIN: [
            "create_user",
            "edit_user",  # Only lower-ranked users
            "delete_user",
            "manage_roles",
            "create_department",
            "edit_department",
            "delete_department",
            "manage_department_ranks",
            "assign_user_rank",
            "assign_departments",
            "assign_request",
            "create_request",
            "edit_request",
            "delete_request",
            "view_all_requests",
            "view_all_users",
            "view_reports",
            "view_departments",
            "view_department_users",
            "create_form_template",
            "edit_form_template",
            "delete_form_template",
            "view_form_templates",
            "submit_form_record",
            "view_form_records",
            "delete_form_record",
            "upload_files",
            "download_files",
            "delete_files",
            "create_company",
            "edit_company",
            "delete_company",
            "view_companies",
            "create_client",
            "edit_client",
            "delete_client",
            "view_clients",
        ],
        UserRole.ADMIN: [
            "create_user",
            "edit_user",  # Only lower-ranked users
            "delete_user",
            "manage_roles",
            "create_department",
            "edit_department",
            "delete_department",
            "manage_department_ranks",
            "assign_user_rank",
            "assign_departments",
            "assign_request",
            "create_request",
            "edit_request",
            "delete_request",
            "view_departments",
            "view_department_users",
            "view_all_requests",
            "view_all_users",
            "view_reports",
            "create_form_template",
            "edit_form_template",
            "delete_form_template",
            "view_form_templates",
            "submit_form_record",
            "view_form_records",
            "delete_form_record",
            "upload_files",
            "download_files",
            "delete_files",
            "create_company",
            "edit_company",
            "delete_company",
            "view_companies",
            "create_client",
            "edit_client",
            "delete_client",
            "view_clients",
        ],
        UserRole.MANAGER: [
            "create_request",
            "edit_request",
            "delete_request",
            "assign_request",
            "view_department_requests",
            "view_department_users",
            "view_departments",
            "manage_department_ranks",
            "assign_user_rank",
            "create_form_template",
            "edit_form_template",
            "view_form_templates",
            "submit_form_record",
            "view_form_records",
            "delete_form_record",
            "upload_files",
            "download_files",
            "delete_files",
            "create_company",
            "edit_company",
            "view_companies",
            "create_client",
            "edit_client",
            "view_clients",
        ],
        UserRole.USER: [
        "create_request",
        "edit_own_request",
        "delete_own_request",
        "view_own_requests",
        "view_created_requests",
        "view_departments",
        "view_department_users",
        "view_form_templates",
        "submit_form_record",
        "view_own_form_records",
        "upload_files",
        "download_files",
        "create_company",
        "edit_company",
        "view_companies",
        "create_client",
        "edit_client",
        "view_clients",
        ],
        UserRole.VIEWER: [
            "view_own_requests",
            "view_departments",
            "view_form_templates",
            "download_files",
            "view_companies",
            "view_clients",
        ],
    }

    @staticmethod
    def has_permission(user_role: UserRole, permission: str) -> bool:
        """Check if role has permission"""
        return permission in PermissionService.PERMISSIONS.get(user_role, [])

    @staticmethod
    def require_permission(user, permission: str):
        """Raise error if user doesn't have permission"""
        if not PermissionService.has_permission(user.role, permission):
            # Log security event
            print(f"⚠️  SECURITY: Unauthorized access attempt - User {user.email} tried '{permission}'")
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: insufficient privileges"
            )

    @staticmethod
    def require_role(user, min_role: UserRole):
        """Check if user has at least this role rank"""
        role_hierarchy = {
            UserRole.SUPERADMIN: 6,
            UserRole.SYSTEM_ADMIN: 5,
            UserRole.ADMIN: 4,
            UserRole.MANAGER: 3,
            UserRole.USER: 2,
            UserRole.VIEWER: 1,
        }
        
        user_rank = role_hierarchy.get(user.role, 0)
        required_rank = role_hierarchy.get(min_role, 0)
        
        if user_rank < required_rank:
            # Log security event
            print(f"⚠️  SECURITY: Role check failed - User {user.email} (role: {user.role}) requires {min_role}")
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient privileges: requires {min_role} or higher"
            )

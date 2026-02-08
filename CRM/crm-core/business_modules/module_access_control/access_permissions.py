from business_modules.module_access_control.access_enums import UserRole
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
            "create_request",
            "edit_request",
            "delete_request",
            "view_all_requests",
            "view_all_users",
            "view_reports",
            "access_superadmin_panel",  # ⚠️ SUPERADMIN ONLY
        ],
        UserRole.ADMIN: [
            "create_user",
            "edit_user",  # Only lower-ranked users
            "delete_user",
            "manage_roles",
            "create_department",
            "edit_department",
            "delete_department",
            "assign_departments",
            "view_all_requests",
            "view_all_users",
            "view_reports",
        ],
        UserRole.MANAGER: [
            "create_request",
            "edit_request",
            "assign_request",
            "view_department_requests",
            "view_department_users",
        ],
        UserRole.USER: [
            "create_request",
            "edit_own_request",
            "view_own_requests",
            "view_created_requests",
        ],
        UserRole.VIEWER: [
            "view_own_requests",
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
            UserRole.SUPERADMIN: 5,
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

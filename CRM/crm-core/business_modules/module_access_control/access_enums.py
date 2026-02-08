import enum

class UserRole(str, enum.Enum):
    SUPERADMIN = "superadmin"      # Can do everything
    ADMIN = "admin"                # Can manage users and departments
    MANAGER = "manager"            # Can manage requests and assign
    USER = "user"                  # Can only view/create requests
    VIEWER = "viewer"              # Read-only access

class WorkspaceStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"
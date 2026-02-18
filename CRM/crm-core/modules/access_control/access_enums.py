import enum


class UserRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"      # Can do everything
    SYSTEM_ADMIN = "SYSTEM_ADMIN"  # System-level admin with extended view
    ADMIN = "ADMIN"                # Can manage users and departments
    MANAGER = "MANAGER"            # Can manage requests and assign
    USER = "USER"                  # Can only view/create requests
    VIEWER = "VIEWER"              # Read-only access


class WorkspaceStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ARCHIVED = "archived"

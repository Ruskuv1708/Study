import enum


class WorkspaceFeature(str, enum.Enum):
    """Features that can be enabled/disabled per workspace"""
    WORKFLOW = "workflow"
    FILE_STORAGE = "file_storage"
    REPORTS = "reports"
    NOTIFICATIONS = "notifications"
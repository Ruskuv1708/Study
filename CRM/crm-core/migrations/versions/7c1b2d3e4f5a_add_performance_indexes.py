"""Add performance indexes

Revision ID: 7c1b2d3e4f5a
Revises: 5feb7f48ebbe
Create Date: 2026-02-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7c1b2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "5feb7f48ebbe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_users_workspace_id ON access_users (workspace_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_users_department_id ON access_users (department_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_access_users_workspace_role ON access_users (workspace_id, role)")

    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_departments_workspace_id ON workflow_departments (workspace_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_requests_workspace_created_at ON workflow_requests (workspace_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_requests_workspace_status_created_at ON workflow_requests (workspace_id, status, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_requests_workspace_department_id ON workflow_requests (workspace_id, department_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_requests_workspace_assigned_to_id ON workflow_requests (workspace_id, assigned_to_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_workflow_requests_workspace_created_by_id ON workflow_requests (workspace_id, created_by_id)")

    op.execute("CREATE INDEX IF NOT EXISTS ix_dynamic_form_templates_workspace_id ON dynamic_form_templates (workspace_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_dynamic_form_records_template_created_at ON dynamic_form_records (template_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_dynamic_form_records_template_created_by_id ON dynamic_form_records (template_id, created_by_id)")

    op.execute("CREATE INDEX IF NOT EXISTS ix_storage_files_workspace_entity ON storage_files (workspace_id, entity_type, entity_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_storage_files_workspace_uploaded_by ON storage_files (workspace_id, uploaded_by_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_storage_files_workspace_created_at ON storage_files (workspace_id, created_at)")

    op.execute("CREATE INDEX IF NOT EXISTS ix_system_notifications_user_read ON system_notifications (user_id, is_read)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_system_notifications_workspace_id ON system_notifications (workspace_id)")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_system_notifications_workspace_id")
    op.execute("DROP INDEX IF EXISTS ix_system_notifications_user_read")

    op.execute("DROP INDEX IF EXISTS ix_storage_files_workspace_created_at")
    op.execute("DROP INDEX IF EXISTS ix_storage_files_workspace_uploaded_by")
    op.execute("DROP INDEX IF EXISTS ix_storage_files_workspace_entity")

    op.execute("DROP INDEX IF EXISTS ix_dynamic_form_records_template_created_by_id")
    op.execute("DROP INDEX IF EXISTS ix_dynamic_form_records_template_created_at")
    op.execute("DROP INDEX IF EXISTS ix_dynamic_form_templates_workspace_id")

    op.execute("DROP INDEX IF EXISTS ix_workflow_requests_workspace_created_by_id")
    op.execute("DROP INDEX IF EXISTS ix_workflow_requests_workspace_assigned_to_id")
    op.execute("DROP INDEX IF EXISTS ix_workflow_requests_workspace_department_id")
    op.execute("DROP INDEX IF EXISTS ix_workflow_requests_workspace_status_created_at")
    op.execute("DROP INDEX IF EXISTS ix_workflow_requests_workspace_created_at")
    op.execute("DROP INDEX IF EXISTS ix_workflow_departments_workspace_id")

    op.execute("DROP INDEX IF EXISTS ix_access_users_workspace_role")
    op.execute("DROP INDEX IF EXISTS ix_access_users_department_id")
    op.execute("DROP INDEX IF EXISTS ix_access_users_workspace_id")

"""Refactor users for role-specific fields

Revision ID: f3b9a6f1d2ab
Revises: c3d0a2e0da47
Create Date: 2026-02-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "f3b9a6f1d2ab"
down_revision: Union[str, Sequence[str], None] = "c3d0a2e0da47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)

    # access_users: workspace_id nullable, add department_id
    op.alter_column(
        "access_users",
        "workspace_id",
        existing_type=postgresql.UUID(),
        nullable=True,
    )
    access_user_cols = {c["name"] for c in inspector.get_columns("access_users")}
    if "department_id" not in access_user_cols:
        op.add_column(
            "access_users",
            sa.Column("department_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    # Create FK only if it doesn't exist
    fks = {fk["name"] for fk in inspector.get_foreign_keys("access_users")}
    if "access_users_department_id_fkey" not in fks:
        op.create_foreign_key(
            "access_users_department_id_fkey",
            "access_users",
            "workflow_departments",
            ["department_id"],
            ["id"],
        )

    # workflow_requests: add created_by_id
    request_cols = {c["name"] for c in inspector.get_columns("workflow_requests")}
    if "created_by_id" not in request_cols:
        op.add_column(
            "workflow_requests",
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
    req_fks = {fk["name"] for fk in inspector.get_foreign_keys("workflow_requests")}
    if "workflow_requests_created_by_id_fkey" not in req_fks:
        op.create_foreign_key(
            "workflow_requests_created_by_id_fkey",
            "workflow_requests",
            "access_users",
            ["created_by_id"],
            ["id"],
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("workflow_requests_created_by_id_fkey", "workflow_requests", type_="foreignkey")
    op.drop_column("workflow_requests", "created_by_id")

    op.drop_constraint("access_users_department_id_fkey", "access_users", type_="foreignkey")
    op.drop_column("access_users", "department_id")
    op.alter_column(
        "access_users",
        "workspace_id",
        existing_type=postgresql.UUID(),
        nullable=False,
    )

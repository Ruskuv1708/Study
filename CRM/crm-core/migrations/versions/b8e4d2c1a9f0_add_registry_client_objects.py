"""add registry client objects table

Revision ID: b8e4d2c1a9f0
Revises: 7c1b2d3e4f5a
Create Date: 2026-02-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8e4d2c1a9f0"
down_revision: Union[str, Sequence[str], None] = "7c1b2d3e4f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "registry_client_objects",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("meta_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["registry_clients.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["access_workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_registry_client_objects_workspace_id", "registry_client_objects", ["workspace_id"], unique=False)
    op.create_index("ix_registry_client_objects_workspace_client", "registry_client_objects", ["workspace_id", "client_id"], unique=False)
    op.create_index("ix_registry_client_objects_workspace_name", "registry_client_objects", ["workspace_id", "name"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_registry_client_objects_workspace_name", table_name="registry_client_objects")
    op.drop_index("ix_registry_client_objects_workspace_client", table_name="registry_client_objects")
    op.drop_index("ix_registry_client_objects_workspace_id", table_name="registry_client_objects")
    op.drop_table("registry_client_objects")

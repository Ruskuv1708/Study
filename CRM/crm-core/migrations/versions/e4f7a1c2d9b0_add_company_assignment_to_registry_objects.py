"""add company assignment to registry client objects

Revision ID: e4f7a1c2d9b0
Revises: b8e4d2c1a9f0
Create Date: 2026-02-20 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e4f7a1c2d9b0"
down_revision: Union[str, Sequence[str], None] = "b8e4d2c1a9f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "registry_client_objects",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_registry_client_objects_company_id_registry_companies",
        "registry_client_objects",
        "registry_companies",
        ["company_id"],
        ["id"],
    )
    op.create_index(
        "ix_registry_client_objects_workspace_company",
        "registry_client_objects",
        ["workspace_id", "company_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_registry_client_objects_workspace_company", table_name="registry_client_objects")
    op.drop_constraint(
        "fk_registry_client_objects_company_id_registry_companies",
        "registry_client_objects",
        type_="foreignkey",
    )
    op.drop_column("registry_client_objects", "company_id")

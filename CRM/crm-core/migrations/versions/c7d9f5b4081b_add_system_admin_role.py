"""Add system_admin role to userrole enum

Revision ID: c7d9f5b4081b
Revises: ab12cd34ef56
Create Date: 2026-02-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7d9f5b4081b"
down_revision: Union[str, Sequence[str], None] = "ab12cd34ef56"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'system_admin'")


def downgrade() -> None:
    # Removing enum values is not supported by PostgreSQL; skip.
    pass

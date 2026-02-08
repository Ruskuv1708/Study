"""Backfill created_by_id on workflow_requests

Revision ID: 9a2c1d3f7b21
Revises: f3b9a6f1d2ab
Create Date: 2026-02-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a2c1d3f7b21"
down_revision: Union[str, Sequence[str], None] = "f3b9a6f1d2ab"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill created_by_id from assigned_to_id when missing."""
    op.execute(
        """
        UPDATE workflow_requests
        SET created_by_id = assigned_to_id
        WHERE created_by_id IS NULL AND assigned_to_id IS NOT NULL
        """
    )


def downgrade() -> None:
    """No-op data migration."""
    pass

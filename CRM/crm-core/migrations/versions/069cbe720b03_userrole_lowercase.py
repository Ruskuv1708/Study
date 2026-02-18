"""Placeholder to keep alembic history in sync.

Revision ID: 069cbe720b03
Revises: c7d9f5b4081b
Create Date: 2026-02-09 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "069cbe720b03"
down_revision: Union[str, Sequence[str], None] = "c7d9f5b4081b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op placeholder keeping history aligned."""
    pass


def downgrade() -> None:
    """No-op placeholder keeping history aligned."""
    pass

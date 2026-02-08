"""Final Fix

Revision ID: c3d0a2e0da47
Revises: ad7675225fbc
Create Date: 2026-02-04 11:21:19.629467

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d0a2e0da47'
down_revision: Union[str, Sequence[str], None] = '0d46e53d8938'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No-op: superseded by initial reset migration.
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # No-op
    pass

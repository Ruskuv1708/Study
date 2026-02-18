"""Final Reset

Revision ID: 406c39b61446
Revises: 
Create Date: 2026-02-04 11:22:16.071716

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '406c39b61446'
down_revision: Union[str, Sequence[str], None] = '9a2c1d3f7b21'
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

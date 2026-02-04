"""Add role and is_active columns to access_users

Revision ID: 8b00a6cb2e1d
Revises: 30c02be64486
Create Date: 2026-02-02 07:15:05.883052

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b00a6cb2e1d'
down_revision: Union[str, Sequence[str], None] = '30c02be64486'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column(
        'access_users',
        sa.Column('role', sa.String(), nullable=True, server_default='user'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.sql.expression.true())
    )

    op.execute("UPDATE access_users SET role = 'user' WHERE role IS NULL")
    op.alter_column('access_users', 'role', nullable=False)
    op.execute("UPDATE access_users SET is_active = true WHERE is_active IS NULL")
    op.alter_column('access_users', 'is_active', nullable=False)




def downgrade():
    op.drop_column('access_users', 'role'),
    op.drop_column('access_users', 'is_active')

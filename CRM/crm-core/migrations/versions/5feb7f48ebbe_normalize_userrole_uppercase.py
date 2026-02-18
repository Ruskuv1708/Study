"""Normalize user roles to uppercase enum values

Revision ID: 5feb7f48ebbe
Revises: 069cbe720b03
Create Date: 2026-02-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5feb7f48ebbe"
down_revision: Union[str, Sequence[str], None] = "069cbe720b03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME TO userrole_old")
    op.execute("CREATE TYPE userrole_new AS ENUM ('SUPERADMIN','SYSTEM_ADMIN','ADMIN','MANAGER','USER','VIEWER')")

    op.execute("ALTER TABLE access_users ALTER COLUMN role TYPE VARCHAR USING role::text")
    op.execute("UPDATE access_users SET role = upper(role::text)")
    op.execute("ALTER TABLE access_users ALTER COLUMN role TYPE userrole_new USING role::userrole_new")

    op.execute("DROP TYPE userrole_old")
    op.execute("ALTER TYPE userrole_new RENAME TO userrole")


def downgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME TO userrole_new")
    op.execute("CREATE TYPE userrole_old AS ENUM ('superadmin','system_admin','admin','manager','user','viewer')")

    op.execute("ALTER TABLE access_users ALTER COLUMN role TYPE VARCHAR USING role::text")
    op.execute("UPDATE access_users SET role = lower(role::text)")
    op.execute("ALTER TABLE access_users ALTER COLUMN role TYPE userrole_old USING role::userrole_old")

    op.execute("DROP TYPE userrole_new")
    op.execute("ALTER TYPE userrole_old RENAME TO userrole")

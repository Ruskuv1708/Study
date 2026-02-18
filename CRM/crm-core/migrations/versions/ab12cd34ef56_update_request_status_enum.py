"""Update request status enum values

Revision ID: ab12cd34ef56
Revises: 406c39b61446
Create Date: 2026-02-08 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ab12cd34ef56"
down_revision: Union[str, Sequence[str], None] = "406c39b61446"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename existing enum so we can create a new one with the final values
    op.execute("ALTER TYPE requeststatus RENAME TO requeststatus_old")

    # Create target enum with lowercase strings to match the ORM values
    op.execute("CREATE TYPE requeststatus_new AS ENUM ('new','assigned','in_process','pending','done')")

    # Switch column to plain text so we can normalize values
    op.execute("ALTER TABLE workflow_requests ALTER COLUMN status TYPE VARCHAR USING status::text")

    # Normalise textual values to the new set
    op.execute("UPDATE workflow_requests SET status='in_process' WHERE status IN ('IN_PROGRESS','IN_PROCESS')")
    op.execute("UPDATE workflow_requests SET status='pending' WHERE status IN ('PENDING_APPROVAL','PENDING')")
    op.execute("UPDATE workflow_requests SET status='done' WHERE status IN ('RESOLVED','CLOSED','DONE')")

    # Convert column to the new enum
    op.execute(
        """
        ALTER TABLE workflow_requests
        ALTER COLUMN status TYPE requeststatus_new
        USING status::requeststatus_new
        """
    )

    # Cleanup types
    op.execute("DROP TYPE requeststatus_old")
    op.execute("ALTER TYPE requeststatus_new RENAME TO requeststatus")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TYPE requeststatus RENAME TO requeststatus_new")
    op.execute("CREATE TYPE requeststatus_old AS ENUM ('NEW','ASSIGNED','IN_PROGRESS','PENDING_APPROVAL','RESOLVED','CLOSED')")
    op.execute("ALTER TABLE workflow_requests ALTER COLUMN status TYPE VARCHAR USING status::text")
    op.execute("UPDATE workflow_requests SET status='IN_PROGRESS' WHERE status='in_process'")
    op.execute("UPDATE workflow_requests SET status='PENDING_APPROVAL' WHERE status='pending'")
    op.execute("UPDATE workflow_requests SET status='RESOLVED' WHERE status='done'")
    op.execute(
        """
        ALTER TABLE workflow_requests
        ALTER COLUMN status TYPE requeststatus_old
        USING status::requeststatus_old
        """
    )
    op.execute("DROP TYPE requeststatus_new")
    op.execute("ALTER TYPE requeststatus_old RENAME TO requeststatus")

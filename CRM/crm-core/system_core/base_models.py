import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from system_core.database_connector import Base
from sqlalchemy import event
from system_core.context import get_current_user_id

# Helper function to get current UTC time
def get_utc_now():
    return datetime.now(timezone.utc)

class CRMBasedModel(Base):
    """
    The DNA for all database tables.
    Includes Identity, Time Auditing, and User Auditing.
    """
    __abstract__ = True

    # 1. Identity
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 2. Time Travel (When did it happen?)
    created_at = Column(DateTime(timezone=True), default=get_utc_now, nullable=False) # <--- CHANGED
    updated_at = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now, nullable=False) # <--- CHANGED
    
    # 3. USER ACCOUNTABILITY (Who did it?) <-- NEW SECTION
    # We store the UUID of the user. 
    # Later, our Service Layer will automatically fill this from the Login Session.
    created_by_id = Column(UUID(as_uuid=True), nullable=True)
    updated_by_id = Column(UUID(as_uuid=True), nullable=True)

    # 4. The "Google Sheets" Bucket (Flexible Data)
    meta_data = Column(JSONB, default={}, nullable=True)

# ... (Class CRMBasedModel is defined above) ...

# 5. THE AUTOMATIC AUDITOR
# This function runs automatically whenever SQLAlchemy prepares to Insert a row.
@event.listens_for(CRMBasedModel, 'before_insert', propagate=True)
def receive_before_insert(mapper, connection, target):
    user_id = get_current_user_id()
    if user_id:
        target.created_by_id = user_id
        target.updated_by_id = user_id

# This runs on Update
@event.listens_for(CRMBasedModel, 'before_update', propagate=True)
def receive_before_update(mapper, connection, target):
    user_id = get_current_user_id()
    if user_id:
        target.updated_by_id = user_id
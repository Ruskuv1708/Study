from contextvars import ContextVar
from typing import Optional
from uuid import UUID

# These variables are "Thread-Safe". 
# Values set here only exist for the specific single request happening right now.

# Stores the workspace ID (Which company site are we looking at?)
workspace_context: ContextVar[Optional[UUID]] = ContextVar("workspace_context", default=None)

# Stores the User ID (Who is logged in?)
user_context: ContextVar[Optional[UUID]] = ContextVar("user_context", default=None)

def get_current_workspace_id() -> Optional[UUID]:
    return workspace_context.get()

def get_current_user_id() -> Optional[UUID]:
    return user_context.get()
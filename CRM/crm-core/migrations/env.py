# migrations/env.py
# ... existing imports ...
from core.database_connector import Base

# --- CRITICAL: IMPORT ALL MODELS HERE ---
# If you don't import them, Alembic thinks the app is empty.

from modules.access_control.access_models import User, Workspace # <--- Ensure these are imported!
from modules.dynamic_records.dynamic_models import *
from modules.workflow.workflow_models import *
from modules.notifications.notif_models import *
from modules.file_storage.file_models import *
# ...
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# --- FIX: Import ALL your models here ---
from core.database_connector import Base  # Ensure Base is imported
# ----------------------------------------

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# target_metadata is important! 
# It must contain the metadata of ALL models you want to migrate.
target_metadata = Base.metadata


# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_inifile_section = config.get_section(my_section)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the create_engine() call we don't
    even need a SQLALCHEMY_DATABASE_URL set in os.environ.
    """
    # ✅ FIXED: Use database_url instead of config_prefix
    import os
    database_url = os.getenv("DATABASE_URL", "postgresql://localhost/crm_db")
    
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # ✅ FIXED: Properly handle configuration
    import os
    from urllib.parse import urlparse
    
    # Get database URL from environment or config
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    configuration = config.get_section(config.config_ini_section)
    if configuration is None:
        configuration = {}
    
    configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

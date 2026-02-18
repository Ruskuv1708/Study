import os
from dotenv import load_dotenv


def _get_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

# Load the .env file immediately
load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    CORS_ORIGINS: str | None = os.getenv("CORS_ORIGINS")
    ALLOWED_HOSTS: str | None = os.getenv("ALLOWED_HOSTS")
    TRUSTED_PROXY_HOSTS: str | None = os.getenv("TRUSTED_PROXY_HOSTS")
    AUTO_CREATE_TABLES: bool = _get_bool("AUTO_CREATE_TABLES", True)
    FILE_STORAGE_ROOT: str = os.getenv("FILE_STORAGE_ROOT", "media_storage")
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", 20))
    ALLOWED_UPLOAD_MIME: str | None = os.getenv("ALLOWED_UPLOAD_MIME")
    FILE_SCAN_COMMAND: str | None = os.getenv("FILE_SCAN_COMMAND")
    FILE_SCAN_TIMEOUT_SECONDS: int = int(os.getenv("FILE_SCAN_TIMEOUT_SECONDS", 30))
    MAX_EXPORT_ROWS: int = int(os.getenv("MAX_EXPORT_ROWS", 5000))
    EXPORT_SPOOL_MAX_MB: int = int(os.getenv("EXPORT_SPOOL_MAX_MB", 10))
    DEFAULT_PAGE_SIZE: int = int(os.getenv("DEFAULT_PAGE_SIZE", 100))
    MAX_PAGE_SIZE: int = int(os.getenv("MAX_PAGE_SIZE", 500))
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", 5))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", 10))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", 30))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", 1800))
    DB_POOL_PRE_PING: bool = _get_bool("DB_POOL_PRE_PING", True)

settings = Settings()

if not settings.DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")
if not settings.SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

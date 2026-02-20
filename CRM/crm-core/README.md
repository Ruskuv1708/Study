# CRM Core (Backend)

FastAPI backend for authentication, workflow requests, dynamic forms, file storage, reports, notifications, and workspace management.

## Run Locally

1. Start PostgreSQL:

```bash
docker-compose up -d
```

2. Install dependencies and run API:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server_entry:crm_core_app --host 127.0.0.1 --port 8000 --reload
```

3. Open API docs:

- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Required Environment Variables

- `DATABASE_URL`
- `SECRET_KEY`

Optional but important:

- `AUTO_CREATE_TABLES`
- `FILE_STORAGE_ROOT`
- `MAX_UPLOAD_MB`
- `MAX_EXPORT_ROWS`
- `CORS_ORIGINS`
- `ALLOWED_HOSTS`
- `TRUSTED_PROXY_HOSTS`

## Migrations

```bash
source venv/bin/activate
alembic upgrade head
```

Create migration:

```bash
alembic revision --autogenerate -m "message"
alembic upgrade head
```

## Module Structure

```text
app/
core/
modules/
  access_control/
  workflow/
  dynamic_records/
  file_storage/
  reports/
  notifications/
  workspace_management/
migrations/
```

## Full Project Docs

See repository-level docs:

- `../README.md`
- `../docs/README.md`

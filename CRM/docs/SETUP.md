# Setup Guide

## 1. Prerequisites

- Python 3.12+
- Node.js 20+
- npm
- Docker (for local PostgreSQL)

## 2. Backend Setup (`crm-core`)

### 2.1 Database

```bash
cd crm-core
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:

- database: `crm_production_db`
- user: `crm_admin`
- password: `crm_secret_password`

### 2.2 Python Environment

```bash
cd crm-core
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2.3 Environment Variables

`crm-core/.env` must define at least:

- `DATABASE_URL`
- `SECRET_KEY`

Current defaults in this repo:

```env
DATABASE_URL=postgresql://crm_admin:crm_secret_password@localhost:5432/crm_production_db
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Additional useful variables:

- `AUTO_CREATE_TABLES` (default: `true`)
- `FILE_STORAGE_ROOT` (default: `media_storage`)
- `MAX_UPLOAD_MB` (default: `20`)
- `MAX_EXPORT_ROWS` (default: `5000`)
- `DEFAULT_PAGE_SIZE` (default: `100`)
- `MAX_PAGE_SIZE` (default: `500`)
- `CORS_ORIGINS`
- `ALLOWED_HOSTS`
- `TRUSTED_PROXY_HOSTS`

### 2.4 Migrations

Alembic is configured in `crm-core/alembic.ini` and `crm-core/migrations/env.py`.

Apply migrations:

```bash
cd crm-core
source venv/bin/activate
alembic upgrade head
```

Create a new migration:

```bash
cd crm-core
source venv/bin/activate
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
```

Note: backend can also auto-create tables at startup when `AUTO_CREATE_TABLES=true`.

### 2.5 Run Backend

```bash
cd crm-core
source venv/bin/activate
uvicorn server_entry:crm_core_app --host 127.0.0.1 --port 8000 --reload
```

OpenAPI docs:

- [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## 3. Frontend Setup (`crm-frontend`)

```bash
cd crm-frontend
npm install
```

Create `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run frontend:

```bash
cd crm-frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Build frontend:

```bash
cd crm-frontend
npm run build
```

## 4. Authentication Bootstrapping

The app requires existing users to sign in. This repository does not include a built-in seeding script. You need at least one valid user record in the database (for example, an admin user).

## 5. Workspace Context

Workspace resolution is handled by backend middleware and request parameters:

- superadmin/system admin usually pass `workspace_id` query param from frontend selection.
- other roles are restricted to `current_user.workspace_id`.

Frontend helper:

- `crm-frontend/src/shared/workspace.ts`

Backend resolver:

- `crm-core/core/workspace_resolver.py`

# Testing and Operations

## Frontend Commands

From `crm-frontend`:

- dev server: `npm run dev`
- production build: `npm run build`
- lint: `npm run lint`
- preview build: `npm run preview`
- E2E tests: `npm run test:e2e`

## Backend Commands

From `crm-core` (with venv activated):

- run API: `uvicorn server_entry:crm_core_app --host 127.0.0.1 --port 8000 --reload`
- migrations up: `alembic upgrade head`
- create migration: `alembic revision --autogenerate -m "message"`

## E2E Test Suite

Location:

- `crm-frontend/tests/e2e/smoke.spec.ts`
- `crm-frontend/tests/e2e/flows.spec.ts`

Environment variables used by tests:

- `E2E_BASE_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SUPERADMIN_EMAIL`
- `E2E_SUPERADMIN_PASSWORD`

Covered flows include:

- login and core navigation
- department creation
- template creation and submission flow
- queue/history/records interactions
- assignment and unassign behavior
- workspace management by superadmin

## Backend Runtime Considerations

## Auto Table Creation

When `AUTO_CREATE_TABLES=true`, startup runs `Base.metadata.create_all(...)`.

Recommendation:

- local dev: keep enabled if helpful
- shared/staging/prod: rely on Alembic migrations

## Pooling and Timeouts

DB pool settings are configurable:

- `DB_POOL_SIZE`
- `DB_MAX_OVERFLOW`
- `DB_POOL_TIMEOUT`
- `DB_POOL_RECYCLE`
- `DB_POOL_PRE_PING`

## Export Limits

Large exports are bounded by:

- `MAX_EXPORT_ROWS`
- `EXPORT_SPOOL_MAX_MB`

If exceeded, endpoints return `413`.

## File Storage Operations

Storage root:

- `FILE_STORAGE_ROOT` (default `media_storage`)

Upload controls:

- `MAX_UPLOAD_MB`
- `ALLOWED_UPLOAD_MIME` (optional allowlist)
- `FILE_SCAN_COMMAND` + `FILE_SCAN_TIMEOUT_SECONDS` (optional scanning hook)

## Workspace Operations

Workspace status affects login/access:

- suspended/inactive workspace users receive `403`

Superadmin panel operations:

- create workspace (with initial admin)
- suspend/activate
- rename/update

## Recommended Operational Checklist

1. Run Alembic migrations before deployment.
2. Set strong `SECRET_KEY`.
3. Configure `CORS_ORIGINS`, `ALLOWED_HOSTS`, and trusted proxies.
4. Back up PostgreSQL and file storage.
5. Monitor failed auth/permission events.
6. Enforce least privilege for operational accounts.

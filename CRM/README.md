# CRM Platform (Monorepo)

This repository contains a multi-workspace CRM platform with:

- `crm-core`: FastAPI backend (auth, workflow, forms, files, reports, notifications, workspace management)
- `crm-frontend`: React + Vite frontend

## Documentation Index

- `docs/SETUP.md`: local setup, environment variables, run commands
- `docs/ARCHITECTURE.md`: system architecture, module boundaries, data model
- `docs/API_REFERENCE.md`: backend endpoint reference by module
- `docs/RBAC.md`: roles, permissions, and access behavior
- `docs/FRONTEND.md`: frontend route map, page behavior, API usage
- `docs/WORKFLOWS.md`: end-to-end business workflows
- `docs/TESTING_AND_OPERATIONS.md`: build/test commands and operational guidance
- `docs/TROUBLESHOOTING.md`: common issues and fixes

## Quick Start

1. Start PostgreSQL:

```bash
cd crm-core
docker-compose up -d
```

2. Start backend:

```bash
cd crm-core
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env .env.local 2>/dev/null || true
uvicorn server_entry:crm_core_app --host 127.0.0.1 --port 8000 --reload
```

3. Start frontend:

```bash
cd crm-frontend
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env
npm run dev -- --host 127.0.0.1 --port 5173
```

4. Open:

- Frontend: `http://127.0.0.1:5173`
- Backend OpenAPI docs: `http://127.0.0.1:8000/docs`

## Repo Structure

```text
CRM/
  crm-core/
    app/
    core/
    modules/
    migrations/
  crm-frontend/
    src/
    tests/
  docs/
```

## Notes

- Backend requires `DATABASE_URL` and `SECRET_KEY`.
- JWT bearer auth is required for all protected endpoints.
- Workspace scoping is enforced in backend logic.

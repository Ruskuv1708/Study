# CRM Frontend

React + TypeScript + Vite UI for the CRM platform.

## Run

```bash
npm install
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env
npm run dev -- --host 127.0.0.1 --port 5173
```

## Build

```bash
npm run build
```

## E2E Tests

```bash
npm run test:e2e
```

Required environment variables for E2E:

- `E2E_BASE_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SUPERADMIN_EMAIL`
- `E2E_SUPERADMIN_PASSWORD`

## Main Source Structure

```text
src/
  app/          # app bootstrap + route map
  layouts/      # shell layout (sidebar/header)
  pages/        # top-level pages
  features/     # domain pages/components (requests/forms)
  shared/       # theme, role/workspace helpers
```

## Full Project Docs

See repository-level docs:

- `../README.md`
- `../docs/README.md`

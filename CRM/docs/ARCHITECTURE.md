# Architecture

## High-Level Overview

The platform is a multi-workspace CRM composed of:

- FastAPI backend (`crm-core`) for domain logic and data access
- React frontend (`crm-frontend`) for UI
- PostgreSQL for persistence
- local filesystem for attachments/reports (`FILE_STORAGE_ROOT`)

## Backend Layers

### Core

- `app/main.py`: FastAPI app creation, middleware, router registration
- `core/config.py`: environment-driven settings
- `core/database_connector.py`: SQLAlchemy engine/session
- `core/security.py`: JWT creation/verification
- `core/middleware.py`: workspace context middleware
- `core/workspace_resolver.py`: safe workspace resolution per role
- `core/base_models.py`: shared model base with:
  - UUID primary key
  - created/updated timestamps
  - created_by_id/updated_by_id audit fields
  - JSONB `meta_data`

### Modules

- `access_control`: users, roles, auth, profile updates
- `workflow`: departments and request lifecycle
- `dynamic_records`: form templates, submissions, request generation
- `file_storage`: upload/download/list/delete attachments
- `reports`: Excel exports for requests/users
- `notifications`: inbox and read state
- `workspace_management`: superadmin workspace lifecycle

## Router Registration Order

In `app/main.py`, routers are mounted as:

1. workspace management
2. access control
3. dynamic forms
4. workflow
5. notifications
6. file storage
7. reports

Root health route:

- `GET /` returns `{ "status": "online" }`

## Multi-Workspace Isolation

Workspace isolation is enforced in two places:

1. Middleware context (`core/middleware.py`)
2. Resolver checks (`core/workspace_resolver.py`)

Rules:

- `SUPERADMIN` and `SYSTEM_ADMIN` must resolve an explicit workspace (`workspace_id` param or context)
- other roles are bound to their own `workspace_id`

## Data Model Summary

### Access

- `access_workspaces`
- `access_users`

### Workflow

- `workflow_departments`
- `workflow_requests`

### Dynamic Forms

- `dynamic_form_templates`
- `dynamic_form_records`

### Files and Notifications

- `storage_files`
- `system_notifications`

All tables inherit common audit/meta fields from `CRMBasedModel`.

## Request Lifecycle

1. Request is created directly (`/workflow/requests`) or via form submission (`/forms/submit`).
2. New requests start as `new`.
3. Assign endpoint sets assignee and auto-sets `assigned`.
4. Status can be updated through allowed transitions using `/workflow/requests/{id}/status`.
5. `done` requests move to history queries (`/workflow/requests/history`).

## Form-to-Request Generation

`dynamic_records` supports request automation through template `request_settings`:

- static department: `department_id`
- dynamic department: `department_field_key` (value from submitted row)
- priority default
- title/description templates using `{field_key}` placeholders

Field types supported by backend validation:

- `text`
- `number`
- `boolean`
- `department_select`

## Report and File Architecture

- Reports are generated as in-memory XLSX streams (`openpyxl`, write-only mode).
- Generated report files are uploaded into `storage_files` with `entity_type=report`.
- Files are physically stored under:
  - `{FILE_STORAGE_ROOT}/{workspace_id}/{generated_uuid}`

## Frontend Architecture

- React + TypeScript + Axios + React Router
- Axios base URL in `src/app/main.tsx`
- route shell in `src/layouts/AppLayout.tsx`
- page-level components under `src/pages` and `src/features/*`

Global UI behavior:

- sidebar navigation
- top header user info
- global assigned-request counters (`assigned`, `new`, `pending`)

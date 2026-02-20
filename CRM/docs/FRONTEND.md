# Frontend Documentation

Frontend stack:

- React 19
- TypeScript
- Vite
- Axios
- React Router

Key files:

- app bootstrap: `crm-frontend/src/app/main.tsx`
- route map: `crm-frontend/src/app/App.tsx`
- shell layout: `crm-frontend/src/layouts/AppLayout.tsx`

## Runtime Configuration

Axios base URL is set from:

- `VITE_API_BASE_URL` (fallback `http://localhost:8000`)

Example `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Route Map

Public:

- `/` -> Login

Authenticated (inside `AppLayout`):

- `/dashboard`
- `/profile`
- `/requests`
- `/requests/assigned`
- `/requests/my` (redirect to `/requests/assigned`)
- `/requests/history`
- `/requests/:id`
- `/departments`
- `/forms`
- `/forms/new`
- `/forms/:id/edit`
- `/forms/:id/fill`
- `/forms/:id/records`
- `/forms/:id/queue`
- `/files` (redirect page to reports)
- `/reports`
- `/admin`
- `/superadmin`

## App Layout Behavior

`AppLayout` provides:

- collapsible sidebar with role-aware menu
- top header with current user identity
- global assigned-request counters:
  - assigned
  - new
  - pending

Notification counters refresh:

- on route change
- every 30 seconds

Counts are computed from:

- `GET /workflow/requests?assignee_id=<current_user_id>`

## Main Pages

## Dashboard (`/dashboard`)

- request summary cards
- status snapshot
- quick request box driven by form templates
- recent requests list

## Requests (`/requests`)

- full request board/list
- template-driven request creation inline
- status changes
- assignment by name suggestions
- delete request action (role-dependent)

## Assigned Requests (`/requests/assigned`)

- only requests assigned to current user
- counters for assigned/new/pending
- direct status update for permitted roles

## Request History (`/requests/history`)

- done requests only
- done timestamp handling from `meta_data.done_at` (fallback `updated_at`)

## Request Details (`/requests/:id`)

- request metadata and assignment display
- unassign action when allowed
- linked form record rendering (if request generated from form submission)

## Departments (`/departments`)

- department list (role-scoped)
- ranked users by role order

## Forms Module

### Templates (`/forms`)

- list templates
- open records/queue/edit
- export records to Excel

### Template Builder (`/forms/new`, `/forms/:id/edit`)

- spreadsheet-like template design
- configurable field types: `text`, `number`, `boolean`, `date`, `department_select`
- include toggles:
  - status column
  - priority column
  - department column
- request settings:
  - default department
  - priority
  - title/description templates
  - dynamic department routing via `department_field_key`

### Form Fill (`/forms/:id/fill`)

- multi-row submission
- row-level validation
- each row submits through `/forms/submit`

### Form Records (`/forms/:id/records`)

- submission table
- export
- delete submission (and linked request)

### Form Queue (`/forms/:id/queue`)

- combined view: record + linked request
- assignment and status controls for authorized roles

## Reports and Files

## Reports Library (`/reports`)

- generate request/user reports with period filters
- custom date range support
- upload report files
- file explorer layout with:
  - folder filtering
  - hierarchical file tree grouped by month
  - search
  - file details pane
  - download/delete actions

Only available to:

- superadmin
- system admin
- admin

## Files Route (`/files`)

- redirects to `/reports`

## Admin Panel (`/admin`)

- workspace-scoped user management
- role updates
- active/inactive toggles
- department CRUD
- department assignment for users
- superadmin/system admin workspace selector

## Superadmin Panel (`/superadmin`)

- workspace creation
- rename
- suspend/activate

Superadmin-only access.

## State and Auth Notes

- auth token is stored in `localStorage` as `crm_token`
- workspace selection for superadmin/system admin is persisted as `crm_workspace_id`
- unauthorized API responses generally redirect to login in major pages

## Known UI Limitations

- `department_select` field type is defined and used in template settings/backend routing, but non-builder form inputs are still rendered mostly through generic controls.

# API Reference

Base URL (local): `http://127.0.0.1:8000`

Auth: bearer token in `Authorization` header:

```http
Authorization: Bearer <jwt>
```

Workspace scoping:

- superadmin/system admin: pass `workspace_id=<uuid>` where needed
- other roles: backend enforces user workspace automatically

Common query params:

- `skip` (default `0`)
- `limit` (default from `DEFAULT_PAGE_SIZE`)

## Health

### `GET /`

Returns API health:

```json
{ "status": "online" }
```

## Access Control (`/access`)

### Auth

- `POST /access/token`
  - form fields: `username`, `password`
  - returns JWT and minimal user payload

### Users

- `POST /access/users`
  - create user
- `GET /access/users`
  - list users (workspace-scoped except superadmin)
- `GET /access/users/{user_id}`
  - get user details
- `PUT /access/users/{user_id}`
  - update user fields (`full_name`, `email`, `is_active`, `department_id`)
- `DELETE /access/users/{user_id}`
  - soft deactivate user (`is_active=false`)
- `PUT /access/users/{user_id}/role`
  - role change with validation

### Department user lookup

- `GET /access/departments/{department_id}/users`
  - list users in a department

### Current user

- `GET /access/me`
- `PUT /access/me`
  - self-edit profile fields (`full_name`, `email`)

## Workflow (`/workflow`)

### Departments

- `POST /workflow/departments`
- `GET /workflow/departments`
- `PUT /workflow/departments/{department_id}`
- `DELETE /workflow/departments/{department_id}`

### Requests

- `POST /workflow/requests`
  - payload: `title`, `description`, `priority`, `department_id`
- `GET /workflow/requests`
  - filters:
    - `department_id`
    - `assignee_id`
- `GET /workflow/requests/history`
  - done requests only
  - same filters as above
- `GET /workflow/requests/{request_id}`
- `POST /workflow/requests/{request_id}/assign`
  - payload: `assignee_id`
- `POST /workflow/requests/{request_id}/unassign`
- `PUT /workflow/requests/{request_id}/status`
  - payload: `{ "status": "new|assigned|in_process|pending|done" }`
- `DELETE /workflow/requests/{request_id}`

## Dynamic Forms (`/forms`)

### Templates

- `POST /forms/template`
  - payload:
    - `name`
    - `structure[]` (`key`, `label`, `type`, `required`)
    - optional `request_settings`
- `GET /forms/templates`
- `GET /forms/templates/{template_id}`
- `PUT /forms/templates/{template_id}`
- `DELETE /forms/templates/{template_id}`

`request_settings` fields:

- `enabled`
- `department_id` (default/fallback)
- `department_field_key` (dynamic routing from row field)
- `priority`
- `title_template`
- `description_template`

### Records

- `POST /forms/submit`
  - payload: `template_id`, `data`
  - may create workflow request automatically (template-driven)
- `GET /forms/records`
  - query: `template_id`
- `GET /forms/records/queue`
  - query: `template_id`
  - returns record + linked request bundle
- `GET /forms/records/by-request/{request_id}`
- `GET /forms/records/excel`
  - query: `template_id`
  - streams XLSX
- `GET /forms/records/{record_id}`
- `DELETE /forms/records/{record_id}`
  - removes linked request as well (best effort)

## File Storage (`/files`)

### List

- `GET /files`
  - filters:
    - `entity_type` (`request`, `report`, or omitted)
    - `entity_id`

### Upload

- `POST /files/upload` (`multipart/form-data`)
  - fields:
    - `file` (required)
    - `entity_type` (optional)
    - `entity_id` (optional but required when `entity_type` is provided)

### Download / Delete

- `GET /files/download/{file_id}`
- `DELETE /files/{file_id}`

Access notes:

- report files (`entity_type=report`) are restricted to superadmin/system admin/admin
- request files validate request-level access
- non-entity files are uploader/admin-scoped

## Reports (`/reports`)

### Requests export

- `GET /reports/requests/excel`
  - optional query:
    - `date_from=YYYY-MM-DD`
    - `date_to=YYYY-MM-DD`
  - streams XLSX

### Users export

- `GET /reports/users/excel`
  - optional date filters same as above
  - streams XLSX

Validation:

- if `date_from > date_to`, returns `400`
- export row limits enforced via `MAX_EXPORT_ROWS`

## Notifications (`/notifications`)

- `GET /notifications/my-inbox`
  - unread notifications for current user
- `POST /notifications/{notif_id}/read`
  - marks notification as read

Note: notification endpoints exist and are functional; request-assignment automation hook is present but not wired end-to-end yet.

## Workspace Management (`/superadmin`)

Superadmin-only endpoints:

- `POST /superadmin/workspaces`
- `GET /superadmin/workspaces`
- `GET /superadmin/workspaces/{workspace_id}`
- `GET /superadmin/workspaces-with-user-count`
- `PUT /superadmin/workspaces/{workspace_id}`
- `PUT /superadmin/workspaces/{workspace_id}/suspend`
- `PUT /superadmin/workspaces/{workspace_id}/activate`

Deprecated compatibility endpoint:

- `POST /superadmin/workspaces/{workspace_id}/suspend`

## cURL Examples

### Login

```bash
curl -X POST http://127.0.0.1:8000/access/token \
  -F "username=admin@example.com" \
  -F "password=Admin123!"
```

### List Requests

```bash
curl "http://127.0.0.1:8000/workflow/requests?workspace_id=<workspace_uuid>" \
  -H "Authorization: Bearer <token>"
```

### Submit Form Row

```bash
curl -X POST http://127.0.0.1:8000/forms/submit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "00000000-0000-0000-0000-000000000000",
    "data": {
      "full_name": "John Doe",
      "amount": 1250
    }
  }'
```

### Upload Request Attachment

```bash
curl -X POST "http://127.0.0.1:8000/files/upload?workspace_id=<workspace_uuid>" \
  -H "Authorization: Bearer <token>" \
  -F "file=@./invoice.pdf" \
  -F "entity_type=request" \
  -F "entity_id=<request_uuid>"
```

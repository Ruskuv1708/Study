# RBAC and Access Rules

## Roles

- `SUPERADMIN`
- `SYSTEM_ADMIN`
- `ADMIN`
- `MANAGER`
- `USER`
- `VIEWER`

Defined in:

- `crm-core/modules/access_control/access_enums.py`

## Permission Model

Permissions are centralized in:

- `crm-core/modules/access_control/access_permissions.py`

Core behavior:

- every protected route calls `PermissionService.require_permission(...)` or role checks
- unauthorized actions return `403`

## High-Level Capability Matrix

| Capability | SUPERADMIN | SYSTEM_ADMIN | ADMIN | MANAGER | USER | VIEWER |
|---|---:|---:|---:|---:|---:|---:|
| Create/Edit/Deactivate Users | Yes | Yes | Yes | No | No | No |
| Manage Roles | Yes | Yes | Yes | No | No | No |
| Manage Workspaces | Yes | No | No | No | No | No |
| Manage Departments | Yes | Yes | Yes | Limited view | View | View |
| Assign Requests | Yes | Yes | Yes | Yes (restricted) | No | No |
| Create Requests | Yes | Yes | Yes | Yes | Yes | No |
| Edit/Delete Requests | Yes | Yes | Yes | Scoped | Own/assigned | No |
| View Requests | All | All | All | Department + own | Own/assigned | Own/assigned |
| Form Template Management | Yes | Yes | Yes | Yes | No | No |
| Submit Form Records | Yes | Yes | Yes | Yes | Yes | No |
| View Form Records | All | All | All | All | Own | No |
| File Upload | Yes | Yes | Yes | Yes | Yes | No |
| File Download | Yes | Yes | Yes | Yes | Yes | Yes |
| Report Access | Yes | Yes | Yes | No | No | No |
| Superadmin Panel | Yes | No | No | No | No | No |

## Additional Enforcement Rules

## User Management Constraints

- admin cannot create/edit high-privilege roles (`SUPERADMIN`, `ADMIN`, `SYSTEM_ADMIN`)
- manager can only create `USER`/`VIEWER`
- manager/user role assignment requires `department_id`
- users cannot deactivate themselves

## Request Assignment Constraints

- manager can assign only ordinary `USER` role
- manager can assign only within their own department
- reassigning an already-assigned request to a different user returns `400`
- assign sets status to `assigned`; unassign sets status to `new`

## Request Visibility Rules

For `list_requests` and `list_done_requests`:

- superadmin/system admin/admin: workspace-wide visibility
- manager: department requests plus own created/assigned
- user/viewer: own created/assigned only

For `get_request_by_id`:

- manager: same department only
- user/viewer: must be creator or assignee

## Status Update Rules

- user/viewer can update only own/assigned requests
- manager can update only requests inside manager department
- invalid status values return `400`

Valid statuses:

- `new`
- `assigned`
- `in_process`
- `pending`
- `done`

## File Access Rules

From `file_storage` service:

- report files (`entity_type=report`): only superadmin/system admin/admin
- request files (`entity_type=request`): request-level access is validated
- generic files (no entity): admins see all, non-admins limited to own uploads

## Workspace Isolation Rules

From `resolve_workspace_id`:

- superadmin/system admin must resolve explicit workspace context
- other roles cannot override workspace outside their own

## Notes for Frontend Developers

- use `/access/me` role data for route/menu visibility
- still rely on backend for final authorization
- for superadmin/system admin pages, include `workspace_id` where relevant

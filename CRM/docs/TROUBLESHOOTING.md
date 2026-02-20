# Troubleshooting

## 401 Unauthorized on API Calls

Symptoms:

- frontend logs show `401 Unauthorized`
- report download endpoints fail with 401

Checks:

1. Ensure `crm_token` exists in browser localStorage.
2. Confirm `Authorization: Bearer <token>` header is included.
3. Verify token is not expired.
4. Re-login to refresh token.

## 403 Forbidden

Common causes:

- role lacks required permission
- workspace mismatch
- workspace suspended/inactive
- file/report entity access restrictions

Checks:

1. inspect current role via `GET /access/me`
2. verify workspace context (`workspace_id` for superadmin/system admin)
3. verify target resource belongs to current workspace

## Workspace Required Errors

Symptoms:

- backend returns `400 "Workspace is required"`

Cause:

- superadmin/system admin request missing resolved workspace

Fix:

- include `workspace_id=<uuid>` query parameter
- ensure frontend selected workspace (`crm_workspace_id`) is set

## File Upload Rejected

Possible errors:

- `413 File exceeds max size`
- `415 Unsupported file type`
- `400 File rejected by security scan`

Fixes:

1. increase `MAX_UPLOAD_MB` if needed
2. adjust `ALLOWED_UPLOAD_MIME`
3. validate/disable `FILE_SCAN_COMMAND` until scanner is configured correctly

## Report Generation Errors

Possible errors:

- `400 date_from must be before or equal to date_to`
- `413 Export exceeds max row limit`

Fixes:

1. correct date range
2. narrow date filter
3. raise `MAX_EXPORT_ROWS` carefully

## No Data in Assigned Requests View

Checks:

1. confirm request is actually assigned to current user
2. ensure request status is not `done` (assigned view uses `/workflow/requests`, which excludes done)
3. confirm workspace context is correct

## Department Delete Fails

Error examples:

- `Cannot delete department with existing requests`
- `Cannot delete department with assigned users`

Fix:

1. move users out of department
2. resolve/delete linked requests
3. retry deletion

## Login Fails for Existing User

Checks:

1. user `is_active` must be true
2. user workspace must be active
3. password hash must match

## Frontend Cannot Reach Backend

Checks:

1. backend running at expected URL/port
2. frontend `.env` has correct `VITE_API_BASE_URL`
3. CORS includes frontend origin (`http://127.0.0.1:5173`)

## Alembic Migration Issues

Checks:

1. `DATABASE_URL` is set in environment
2. model imports are present in `migrations/env.py`
3. run:

```bash
cd crm-core
source venv/bin/activate
alembic upgrade head
```

## Known Implementation Notes

1. Notification API exists, but automatic assignment notification dispatch is not fully wired.
2. `department_select` is supported in backend schema/routing, while some frontend entry forms still render generic field controls.
3. `/files` frontend route currently redirects to `/reports`.

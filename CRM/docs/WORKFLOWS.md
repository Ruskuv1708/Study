# Business Workflows

## 1. User Login

1. Frontend submits form data to `POST /access/token`.
2. Backend validates user, password, active status, and workspace status.
3. JWT is returned and stored in `localStorage` (`crm_token`).
4. Frontend uses bearer token for all subsequent API calls.

## 2. Request Management (Direct)

### Create

1. User selects department and enters request details.
2. Frontend calls `POST /workflow/requests`.
3. Backend validates department and workspace.
4. Request is created with status `new`.

### Assign

1. Manager/admin chooses assignee.
2. Frontend calls `POST /workflow/requests/{id}/assign`.
3. Backend enforces role/department constraints.
4. Status automatically becomes `assigned`.

### Status Updates

1. Frontend calls `PUT /workflow/requests/{id}/status`.
2. Backend enforces scope rules.
3. If status becomes `done`, backend stores `meta_data.done_at`.

## 3. Template-Driven Request Creation

### Template Authoring

1. Manager/admin creates template in Template Builder.
2. Defines schema fields and request settings.
3. Optional dynamic department routing:
   - set `department_field_key` to a row field key.

### Submission

1. User fills rows in Form Fill or request-form panel.
2. Each row is posted to `POST /forms/submit`.
3. Backend validates fields by type and required flags.
4. If `request_settings.enabled`, backend creates workflow request.
5. Record metadata stores linked `request_id`; request metadata stores `template_id` and `record_id`.

## 4. Queue Operations for Template Requests

1. Queue page loads via `GET /forms/records/queue`.
2. Each entry has:
   - form record data
   - optional linked request data
3. Managers/admins can:
   - assign/unassign request
   - update status
   - navigate to request details

## 5. Report Generation and Storage

1. Admin/superadmin picks report type and date period in Reports page.
2. Frontend requests XLSX stream:
   - `/reports/requests/excel` or `/reports/users/excel`
3. Generated blob is re-uploaded as `entity_type=report` via `/files/upload`.
4. File appears in reports library and file tree.
5. Users can download or delete stored reports.

## 6. File Attachments

### Upload

1. Frontend posts `multipart/form-data` to `/files/upload`.
2. Backend validates entity access and optional MIME allowlist.
3. File is stored physically under workspace folder.
4. File metadata is saved in `storage_files`.

### Download/Delete

1. Backend validates access by entity type and role.
2. For request files, request-level access checks apply.
3. For report files, admin-level roles only.

## 7. Assigned Requests and Global Counters

1. Assigned Requests page fetches requests filtered by `assignee_id`.
2. Layout header also calls assigned filter endpoint.
3. Header shows counts everywhere:
   - assigned
   - new
   - pending
4. Counts refresh every 30 seconds.

## 8. Workspace Administration

Superadmin can:

1. Create workspace + initial admin user.
2. Suspend or reactivate workspace.
3. Rename/update workspace settings.

Workspace suspension blocks user access at auth/security checks.

## 9. Notifications

Available API workflow:

1. Create notification via `NotificationService.send_notification`.
2. Read inbox via `GET /notifications/my-inbox`.
3. Mark read via `POST /notifications/{id}/read`.

Current integration note:

- Assignment flow includes a TODO hook for notification trigger; full automatic assignment notifications are not yet wired.

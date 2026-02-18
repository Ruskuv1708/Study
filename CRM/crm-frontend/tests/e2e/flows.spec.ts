import { test, expect } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const superEmail = process.env.E2E_SUPERADMIN_EMAIL
const superPassword = process.env.E2E_SUPERADMIN_PASSWORD

const requireAdminCredentials = () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run E2E tests.')
}

const requireSuperCredentials = () => {
  test.skip(!superEmail || !superPassword, 'Set E2E_SUPERADMIN_EMAIL and E2E_SUPERADMIN_PASSWORD to run superadmin E2E.')
}

const login = async (page: any, email: string, password: string) => {
  await page.goto('/')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('Welcome back,')).toBeVisible()
}

test('admin can create template, submit request, and review queue/history/records', async ({ page }) => {
  test.slow()
  requireAdminCredentials()

  const stamp = Date.now()
  const deptName = `E2E Dept ${stamp}`
  const templateName = `E2E Template ${stamp}`
  const submitName = `E2E User ${stamp}`
  const requestTitle = `E2E Request for ${submitName}`

  await login(page, adminEmail!, adminPassword!)

  // Create department
  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
  await page.getByPlaceholder('Department name').fill(deptName)
  await page.getByPlaceholder('Description (optional)').fill('Created by Playwright')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: deptName })).toBeVisible()

  // Build template
  await page.getByRole('button', { name: 'Forms', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Form Templates' })).toBeVisible()
  await page.getByRole('button', { name: 'New Template' }).click()
  await expect(page.getByRole('heading', { name: 'Create Template' })).toBeVisible()
  await page.getByPlaceholder('e.g. Purchase Request').fill(templateName)

  const columnSettings = page.locator('div', { hasText: 'Column Settings' }).first()
  await columnSettings.locator('input[placeholder="Column label"]').first().fill('Full Name')
  await columnSettings.locator('input[placeholder="column_key"]').fill('full_name')

  await page.locator('label', { hasText: 'Department' }).locator('..').locator('select').selectOption({ label: deptName })
  await page.getByPlaceholder('Use {field_key} placeholders').fill('E2E Request for {full_name}')
  await page.getByPlaceholder('Optional description template').fill('Submitted by {full_name}')

  await page.getByRole('button', { name: 'Save Template' }).click()
  await page.waitForURL('**/forms')
  await expect(page.getByText(templateName)).toBeVisible()

  // Submit request from template
  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All Requests' })).toBeVisible()
  await page.getByRole('button', { name: '+ New Request' }).click()
  const createPanel = page.getByRole('heading', { name: 'New Request (Template)' }).locator('..')
  await createPanel.locator('select').first().selectOption({ label: templateName })
  await createPanel.locator('input[type="text"]').first().fill(submitName)
  await createPanel.getByRole('button', { name: 'Submit Requests' }).click()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  // View request details + submitted data
  const requestCard = page
    .getByRole('heading', { name: requestTitle })
    .locator('..')
    .locator('..')
    .locator('..')
  await requestCard.scrollIntoViewIfNeeded()
  await requestCard.getByRole('button', { name: 'View Details' }).click()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()
  await expect(page.getByText('Submitted Data')).toBeVisible()
  await expect(page.getByText('Full Name')).toBeVisible()
  const submittedSection = page.getByRole('heading', { name: 'Submitted Data' }).locator('..')
  await expect(submittedSection.getByText(submitName)).toBeVisible()

  await page.getByRole('button', { name: /Back to Requests/i }).click()

  // Mark as done and verify in history
  const requestCardAfter = page
    .getByRole('heading', { name: requestTitle })
    .locator('xpath=ancestor::div[.//input[@placeholder=\"Assign by name\"]][1]')
  await requestCardAfter.locator('select').first().selectOption('done')
  await page.getByRole('button', { name: 'History' }).click()
  await expect(page.getByRole('heading', { name: 'Request History' })).toBeVisible()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  // Verify records + queue
  await page.getByRole('button', { name: 'Forms', exact: true }).click()
  const templateRow = page.getByText(templateName).locator('..')
  await templateRow.getByRole('button', { name: 'Records' }).click()
  await expect(page.getByRole('heading', { name: `${templateName} - Records` })).toBeVisible()
  await expect(page.getByText(submitName)).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()

  const templateRowQueue = page.getByText(templateName).locator('..')
  await templateRowQueue.getByRole('button', { name: 'Queue' }).click()
  await expect(page.getByRole('heading', { name: `${templateName} - Queue` })).toBeVisible()
  const queueRow = page.getByText(requestTitle).locator('..').locator('..')
  await queueRow.locator('select').first().selectOption('pending')
  await expect(queueRow.locator('select').first()).toHaveValue('pending')

  // Export records to cover download flow
  await page.getByRole('button', { name: 'Back' }).click()
  const templateRowExport = page.getByText(templateName).locator('..')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    templateRowExport.getByRole('button', { name: 'Export' }).click()
  ])
  expect(download.suggestedFilename()).toContain(`${templateName}_records`)
})

test('admin can create a user and update profile', async ({ page }) => {
  test.slow()
  requireAdminCredentials()

  const stamp = Date.now()
  const deptName = `E2E User Dept ${stamp}`
  const userEmail = `e2e.user.${stamp}@example.com`
  const userName = `E2E User ${stamp}`
  const updatedName = `E2E Updated ${stamp}`

  await login(page, adminEmail!, adminPassword!)

  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

  await page.getByPlaceholder('Department name').fill(deptName)
  await page.getByPlaceholder('Description (optional)').fill('Dept for user creation')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: deptName })).toBeVisible()

  await page.getByRole('button', { name: /Create New User/i }).click()
  await page.locator('label', { hasText: 'Full Name:' }).locator('..').locator('input').fill(userName)
  await page.locator('label', { hasText: 'Email:' }).locator('..').locator('input').fill(userEmail)
  await page.locator('label', { hasText: 'Password:' }).locator('..').locator('input').fill('User123!')
  await page.locator('label', { hasText: 'Role:' }).locator('..').locator('select').selectOption({ label: 'User' })
  await page.locator('label', { hasText: 'Workspace:' }).locator('..').locator('select').selectOption({ index: 1 })
  await page.locator('label', { hasText: 'Department:' }).locator('..').locator('select').selectOption({ label: deptName })

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Create User' }).click()
  await expect(page.getByRole('cell', { name: userEmail })).toBeVisible()

  const userRow = page.getByRole('cell', { name: userEmail }).locator('..')
  await userRow.getByRole('button', { name: /Deactivate/i }).click()
  await expect(userRow.getByText('❌ Inactive')).toBeVisible()

  // Profile update
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: /My Profile/i })).toBeVisible()
  await page.getByRole('button', { name: /Edit Profile/i }).click()
  const nameInput = page.locator('input[type="text"]').first()
  await nameInput.fill(updatedName)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Save Changes/i }).click()
  await page.getByRole('button', { name: /Back to Dashboard/i }).click()

  // Re-open profile to confirm persisted update
  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  const nameSection = page.getByRole('main').locator('label', { hasText: 'Full Name' }).locator('..')
  await expect(nameSection.getByText(updatedName)).toBeVisible()
})

test('admin can assign requests and users can view department rankings', async ({ page }) => {
  test.slow()
  requireAdminCredentials()

  const stamp = Date.now()
  const deptName = `E2E Assign Dept ${stamp}`
  const assigneeName = `E2E User ${stamp}`
  const assigneeEmail = `e2e.user.${stamp}@example.com`
  const assigneePassword = 'User123!'
  const templateName = `E2E Assign Template ${stamp}`
  const submitName = `E2E Submit ${stamp}`
  const requestTitle = `E2E Assign Request ${submitName}`

  await login(page, adminEmail!, adminPassword!)

  // Create department
  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()
  await page.getByPlaceholder('Department name').fill(deptName)
  await page.getByPlaceholder('Description (optional)').fill('Dept for assignment test')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: deptName })).toBeVisible()

  // Create assignable user
  await page.getByRole('button', { name: /Create New User/i }).click()
  await page.locator('label', { hasText: 'Full Name:' }).locator('..').locator('input').fill(assigneeName)
  await page.locator('label', { hasText: 'Email:' }).locator('..').locator('input').fill(assigneeEmail)
  await page.locator('label', { hasText: 'Password:' }).locator('..').locator('input').fill(assigneePassword)
  await page.locator('label', { hasText: 'Role:' }).locator('..').locator('select').selectOption('USER')
  await page.locator('label', { hasText: 'Workspace:' }).locator('..').locator('select').selectOption({ index: 1 })
  await page.locator('label', { hasText: 'Department:' }).locator('..').locator('select').selectOption({ label: deptName })
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Create User' }).click()
  await expect(page.getByRole('cell', { name: assigneeEmail })).toBeVisible()

  // Build template
  await page.getByRole('button', { name: 'Forms', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Form Templates' })).toBeVisible()
  await page.getByRole('button', { name: 'New Template' }).click()
  await expect(page.getByRole('heading', { name: 'Create Template' })).toBeVisible()
  await page.getByPlaceholder('e.g. Purchase Request').fill(templateName)
  const columnSettings = page.locator('div', { hasText: 'Column Settings' }).first()
  await columnSettings.locator('input[placeholder="Column label"]').first().fill('Requester')
  await columnSettings.locator('input[placeholder="column_key"]').fill('requester')
  await page.locator('label', { hasText: 'Department' }).locator('..').locator('select').selectOption({ label: deptName })
  await page.getByPlaceholder('Use {field_key} placeholders').fill('E2E Assign Request {requester}')
  await page.getByPlaceholder('Optional description template').fill('Assigned by {requester}')
  await page.getByRole('button', { name: 'Save Template' }).click()
  await page.waitForURL('**/forms')
  await expect(page.getByText(templateName)).toBeVisible()

  // Submit request
  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All Requests' })).toBeVisible()
  await page.getByRole('button', { name: '+ New Request' }).click()
  const createPanel = page.getByRole('heading', { name: 'New Request (Template)' }).locator('..')
  await createPanel.locator('select').first().selectOption({ label: templateName })
  await createPanel.locator('input[type="text"]').first().fill(submitName)
  await createPanel.getByRole('button', { name: 'Submit Requests' }).click()
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible()

  // Assign to user by name
  const assignCard = page
    .getByRole('heading', { name: requestTitle })
    .locator('xpath=ancestor::div[.//input[@placeholder=\"Assign by name\"]][1]')
  await assignCard.getByPlaceholder('Assign by name').fill(assigneeName)
  await assignCard.getByRole('button', { name: 'Assign' }).click()
  await expect(assignCard.getByText(`Assigned to: ${assigneeName}`)).toBeVisible()

  // Unassign via details page
  const detailsCard = page.getByRole('heading', { name: requestTitle }).locator('..').locator('..').locator('..')
  await Promise.all([
    page.waitForURL('**/requests/**'),
    detailsCard.getByRole('button', { name: 'View Details' }).click()
  ])
  await expect(page.getByText(`Assigned to: ${assigneeName}`)).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Unassign' }).click()
  await expect(page.locator('text=Assigned to:')).toHaveCount(0)
  await page.getByRole('button', { name: /Back to Requests/i }).click()

  // Login as user and confirm department rankings are visible
  await page.getByRole('button', { name: /Logout/i }).click()
  await login(page, assigneeEmail, assigneePassword)
  await page.getByRole('button', { name: 'Departments' }).first().click()
  await expect(page.getByRole('heading', { name: 'Departments & Rankings' })).toBeVisible()
  await expect(page.getByText(deptName)).toBeVisible()
  const deptSection = page.getByRole('heading', { name: deptName }).locator('xpath=ancestor::section[1]')
  await expect(deptSection.getByRole('cell', { name: assigneeName })).toBeVisible()
})

test('superadmin can manage workspaces', async ({ page }) => {
  requireSuperCredentials()

  await login(page, superEmail!, superPassword!)
  await page.getByRole('button', { name: 'Superadmin', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Superadmin Control Center/i })).toBeVisible()

  const stamp = Date.now()
  const workspaceName = `E2E Workspace ${stamp}`
  const renamedName = `${workspaceName} Renamed`
  const subdomain = `e2e${stamp}`
  const adminEmail = `e2e.admin.${stamp}@example.com`
  const adminPassword = 'Admin123!'
  const adminName = `E2E Admin ${stamp}`

  await page.getByRole('button', { name: '+ New Workspace' }).click()
  await page.locator('label', { hasText: 'Company Name' }).locator('..').locator('input').fill(workspaceName)
  await page.locator('label', { hasText: 'Subdomain' }).locator('..').locator('input').fill(subdomain)
  await page.locator('label', { hasText: 'Full Name' }).locator('..').locator('input').fill(adminName)
  await page.locator('label', { hasText: 'Email Address' }).locator('..').locator('input').fill(adminEmail)
  await page.locator('label', { hasText: 'Password' }).locator('..').locator('input').fill(adminPassword)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Create Workspace' }).click()
  await expect(page.getByText(workspaceName)).toBeVisible()

  const workspaceRow = page.getByRole('cell', { name: workspaceName }).locator('..')
  page.once('dialog', dialog => dialog.accept(renamedName))
  await workspaceRow.getByRole('button', { name: 'Rename' }).click()
  await expect(page.getByRole('cell', { name: renamedName })).toBeVisible()

  const renamedRow = page.getByRole('cell', { name: renamedName }).locator('..')
  page.once('dialog', dialog => dialog.accept())
  await renamedRow.getByRole('button', { name: 'Suspend' }).click()
  await expect(renamedRow.getByText('Suspended')).toBeVisible()

  await renamedRow.getByRole('button', { name: 'Activate' }).click()
  await expect(renamedRow.getByText('Active')).toBeVisible()
})

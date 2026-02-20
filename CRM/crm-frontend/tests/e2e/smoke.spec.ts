import { test, expect } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

const requireCredentials = () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run E2E tests.')
}

const login = async (page: any) => {
  await page.goto('/')
  await page.getByPlaceholder('Email').fill(adminEmail!)
  await page.getByPlaceholder('Password').fill(adminPassword!)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL('**/dashboard')
  await expect(page.getByText('Welcome back,')).toBeVisible()
}

test('login and navigate core pages', async ({ page }) => {
  requireCredentials()
  await login(page)

  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All Requests' })).toBeVisible()

  await page.getByRole('button', { name: 'Departments', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Departments & Rankings' })).toBeVisible()

  await page.getByRole('button', { name: 'Forms', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Form Templates' })).toBeVisible()

  await page.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Reports Library' })).toBeVisible()

  await page.getByRole('button', { name: 'Admin', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

  await page.getByRole('button', { name: 'Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: /My Profile/i })).toBeVisible()
})

test('admin can create department', async ({ page }) => {
  requireCredentials()
  await login(page)

  await page.getByRole('button', { name: 'Admin' }).click()
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible()

  const deptName = `E2E Dept ${Date.now()}`
  await page.getByPlaceholder('Department name').fill(deptName)
  await page.getByPlaceholder('Description (optional)').fill('Created by Playwright')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByRole('cell', { name: deptName })).toBeVisible()
})

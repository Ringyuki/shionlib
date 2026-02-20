import { expect, test } from '@playwright/test'
import { E2E_FIXTURES } from '../_helpers/fixtures.mjs'

const resolveMeStatus = page =>
  page.evaluate(async () => {
    const response = await fetch('/api/user/me', {
      credentials: 'include',
    })
    return response.status
  })

test.describe('Auth login dialog UI', () => {
  test('login dialog should validate fields and submit with real input', async ({ page }) => {
    const response = await page.goto('/en')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const openLoginDialogButton = page.getByRole('button', { name: /^Log in$/ }).first()
    await expect(openLoginDialogButton).toBeVisible()
    await openLoginDialogButton.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Log in to Shionlib')).toBeVisible()

    const submitButton = dialog.getByRole('button', { name: /^Log in$/ })
    await submitButton.click()

    await expect(dialog.getByText('Email or username is required')).toBeVisible()
    await expect(dialog.getByText('Password must be at least 8 characters')).toBeVisible()

    await dialog.getByLabel('Email or username').fill(E2E_FIXTURES.users.login.identifier)
    await dialog.getByLabel('Password').fill(E2E_FIXTURES.users.login.password)

    const loginResponsePromise = page.waitForResponse(response => {
      return response.request().method() === 'POST' && response.url().includes('/api/user/login')
    })
    await submitButton.click()
    const loginResponse = await loginResponsePromise
    expect(loginResponse.ok()).toBeTruthy()

    await expect.poll(() => resolveMeStatus(page)).toBe(200)
    await expect(dialog).toBeHidden()
  })
})

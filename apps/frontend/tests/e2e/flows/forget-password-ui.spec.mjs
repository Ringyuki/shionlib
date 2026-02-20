import { expect, test } from '@playwright/test'

test.describe('Forget password UI', () => {
  test('forget password form should validate email format before submit', async ({ page }) => {
    const response = await page.goto('/en/user/password/forget')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await page.getByLabel('Email', { exact: true }).fill('invalid-email')
    await page.getByRole('button', { name: 'Send reset email' }).click()

    await expect(page.getByText('Please enter a valid email address')).toBeVisible()
  })
})

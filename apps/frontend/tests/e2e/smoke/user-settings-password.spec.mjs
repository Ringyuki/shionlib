import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

test.describe('User settings and password-forget pages', () => {
  test('logged-in user should access personal/security/site/download settings routes', async ({
    page,
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    await applyAuthCookiesToPageContext(page, authCookies)

    const personalResponse = await page.goto('/en/user/settings/personal')
    expect(personalResponse).not.toBeNull()
    expect(personalResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/en\/user\/settings\/personal$/)
    await expect(
      page.locator(`input[value="${E2E_FIXTURES.users.login.identifier}"]`).first(),
    ).toBeVisible()

    const siteResponse = await page.goto('/en/user/settings/site')
    expect(siteResponse).not.toBeNull()
    expect(siteResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/en\/user\/settings\/site$/)
    await expect(page.getByRole('combobox').first()).toBeVisible()

    const downloadResponse = await page.goto('/en/user/settings/download')
    expect(downloadResponse).not.toBeNull()
    expect(downloadResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/en\/user\/settings\/download$/)
    await expect(page.locator('input[value="localhost"]').first()).toBeVisible()

    const securityResponse = await page.goto('/en/user/settings/security')
    expect(securityResponse).not.toBeNull()
    expect(securityResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/en\/user\/settings\/security$/)
    await expect(page.getByTestId('settings-password-card')).toBeVisible()
  })

  test('forget password page should render request form', async ({ page }) => {
    const response = await page.goto('/en/user/password/forget')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/user\/password\/forget$/)
    await expect(page.getByRole('textbox').first()).toBeVisible()
    await expect(page.getByRole('button').first()).toBeVisible()
  })
})

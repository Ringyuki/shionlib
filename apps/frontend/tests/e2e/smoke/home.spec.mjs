import { expect, test } from '@playwright/test'

test.describe('Home smoke', () => {
  test('root page should render', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
  })
})

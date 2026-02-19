import { expect, test } from '@playwright/test'
import { E2E_FIXTURES } from '../_helpers/fixtures.mjs'

test.describe('Home smoke', () => {
  test('home should render seeded content', async ({ page }) => {
    const response = await page.goto('/en')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('body')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title }).first(),
    ).toBeVisible()
  })
})

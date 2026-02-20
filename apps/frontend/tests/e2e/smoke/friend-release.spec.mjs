import { expect, test } from '@playwright/test'

test.describe('Friend link and release pages', () => {
  test('friend-link page should render configured links', async ({ page }) => {
    const response = await page.goto('/en/friend-link')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page.getByText('KUN Visual Novel Forum').first()).toBeVisible()
    await expect(page.locator('a[href^="https://www.kungal.com"]').first()).toBeVisible()
  })

  test('release page should render release list or empty state', async ({ page }) => {
    const response = await page.goto('/en/release')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const releaseLinks = page.locator('a[href*="/game/"]')
    if ((await releaseLinks.count()) > 0) {
      await expect(releaseLinks.first()).toBeVisible()
    } else {
      await expect(page.locator('[data-slot="empty-title"]')).toBeVisible()
    }
  })
})

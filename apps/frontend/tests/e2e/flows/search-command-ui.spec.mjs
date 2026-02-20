import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, findGameIdByTitle } from '../_helpers/fixtures.mjs'

test.describe('Search command UI', () => {
  test('search trigger should accept input and navigate on Enter', async ({ page, request }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)

    const response = await page.goto('/en')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const searchInput = page.locator('[data-slot="command-input"]').first()
    await page.keyboard.press('Control+k')
    try {
      await expect(searchInput).toBeVisible({ timeout: 1500 })
    } catch {
      await page.keyboard.press('Meta+k')
      await expect(searchInput).toBeVisible()
    }

    await searchInput.fill(E2E_FIXTURES.games.primary.title)
    await searchInput.press('Enter')

    await expect(page).toHaveURL(/\/en\/search\/game\?q=/)

    const currentUrl = new URL(page.url())
    expect(currentUrl.pathname).toBe('/en/search/game')
    expect(currentUrl.searchParams.get('q')).toBe(E2E_FIXTURES.games.primary.title)

    await expect(page.locator(`a[href$="/game/${primaryGameId}"]`).first()).toBeVisible()
  })
})

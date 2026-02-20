import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, findGameIdByTitle } from '../_helpers/fixtures.mjs'

test.describe('Search pages', () => {
  test('search hub should redirect to search game route', async ({ page }) => {
    await page.goto('/en/search')
    await expect(page).toHaveURL(/\/search\/game(?:\?.*)?$/)
  })

  test('search game page should find seeded game and navigate to detail', async ({
    page,
    request,
  }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const keyword = E2E_FIXTURES.games.primary.title.split(' ')[0]

    const response = await page.goto(`/en/search/game?q=${encodeURIComponent(keyword)}`)
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    const gameLink = page.locator(`a[href$="/game/${primaryGameId}"]`).first()
    await expect(gameLink).toBeVisible()

    await gameLink.click()
    await expect(page).toHaveURL(new RegExp(`/en/game/${primaryGameId}$`))
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title }),
    ).toBeVisible()
  })
})

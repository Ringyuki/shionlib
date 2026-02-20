import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, findGameIdByTitle } from '../_helpers/fixtures.mjs'

test.describe('Error and locale behavior', () => {
  test('non-existent page should return 404', async ({ page }) => {
    const response = await page.goto('/en/__e2e_non_existent_page__')
    expect(response).not.toBeNull()
    expect(response.status()).toBe(404)
  })

  test('same game detail route should be reachable in different locales', async ({
    page,
    request,
  }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)

    const enResponse = await page.goto(`/en/game/${primaryGameId}`)
    expect(enResponse).not.toBeNull()
    expect(enResponse.ok()).toBeTruthy()
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title }),
    ).toBeVisible()

    const zhResponse = await page.goto(`/zh/game/${primaryGameId}`)
    expect(zhResponse).not.toBeNull()
    expect(zhResponse.ok()).toBeTruthy()
    await expect(page).toHaveURL(new RegExp(`/zh/game/${primaryGameId}$`))
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, findGameIdByTitle } from '../_helpers/fixtures.mjs'

test.describe('Game list page', () => {
  test('should show seeded games and navigate to detail page', async ({ page, request }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)

    const response = await page.goto('/en/game')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title })).toBeVisible()

    await page.getByRole('link', { name: E2E_FIXTURES.games.primary.title }).first().click()
    await expect(page).toHaveURL(new RegExp(`/en/game/${primaryGameId}$`))
    await expect(page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title })).toBeVisible()
  })
})

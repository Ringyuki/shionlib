import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  findFirstCharacterNameByGameId,
  findGameIdByTitle,
} from '../_helpers/fixtures.mjs'

test.describe('Game detail page', () => {
  test('should render seeded detail, comments and characters', async ({ page, request }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const firstCharacterName = await findFirstCharacterNameByGameId(request, primaryGameId)

    await page.goto(`/en/game/${primaryGameId}`)
    await expect(
      page.getByRole('heading', { name: E2E_FIXTURES.games.primary.title }),
    ).toBeVisible()

    await page.goto(`/en/game/${primaryGameId}/comments`)
    await expect(page.getByText(E2E_FIXTURES.comments.root).first()).toBeVisible()

    await page.goto(`/en/game/${primaryGameId}/characters`)
    await expect(page.getByText(firstCharacterName)).toBeVisible()
  })
})

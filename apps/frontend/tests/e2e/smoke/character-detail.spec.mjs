import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  findFirstCharacterByGameId,
  findGameIdByTitle,
} from '../_helpers/fixtures.mjs'

test.describe('Character detail page', () => {
  test('should render seeded character detail', async ({ page, request }) => {
    const primaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.primary.title)
    const character = await findFirstCharacterByGameId(request, primaryGameId)

    const response = await page.goto(`/en/character/${character.id}`)
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page.getByText(character.name).first()).toBeVisible()
  })
})

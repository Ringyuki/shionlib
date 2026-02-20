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
    await expect(page.getByRole('button', { name: 'Download' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Patch' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible()

    const downloadSourceResponse = await request.get(`/api/game/${primaryGameId}/download-source`)
    expect(downloadSourceResponse.ok()).toBeTruthy()
    const downloadSourcePayload = await downloadSourceResponse.json()
    expect(downloadSourcePayload?.code).toBe(0)
    expect(Array.isArray(downloadSourcePayload?.data)).toBeTruthy()

    await page.goto(`/en/game/${primaryGameId}/comments`)
    await expect(page.getByText(E2E_FIXTURES.comments.root).first()).toBeVisible()

    await page.goto(`/en/game/${primaryGameId}/characters`)
    await expect(page.getByText(firstCharacterName)).toBeVisible()
  })
})

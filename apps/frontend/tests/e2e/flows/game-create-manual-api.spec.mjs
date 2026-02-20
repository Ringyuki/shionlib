import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Expected success response, got ${response.status()}: ${body}`)
  }
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const createManualGame = async (request, authHeaders, title) => {
  const data = await expectApiSuccess(
    await request.post('/api/game/create/game', {
      headers: authHeaders,
      data: {
        title_en: title,
        intro_en: 'Created by e2e manual create flow.',
        tags: ['e2e', 'manual-create'],
        platform: ['pc'],
      },
    }),
  )

  const gameId = Number(data)
  expect(Number.isInteger(gameId)).toBeTruthy()
  return gameId
}

const updateAdminGameStatus = async (request, authHeaders, gameId, status) => {
  await expectApiSuccess(
    await request.patch(`/api/admin/content/games/${gameId}/status`, {
      headers: authHeaders,
      data: {
        status,
      },
    }),
  )
}

const deleteAdminGame = async (request, authHeaders, gameId) => {
  await request.delete(`/api/admin/content/games/${gameId}`, {
    headers: authHeaders,
  })
}

test.describe('Manual game create api flow', () => {
  test('should create game manually and read it via edit scalar endpoint', async ({ request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const authHeaders = { cookie: adminAuth.cookieHeader }

    const title = `E2E Manual Create ${Date.now()}`
    const gameId = await createManualGame(request, authHeaders, title)
    let deleted = false

    try {
      await updateAdminGameStatus(request, authHeaders, gameId, 2)

      const gameScalar = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/scalar`, {
          headers: authHeaders,
        }),
      )

      expect(gameScalar?.title_en).toBe(title)
      expect(gameScalar?.intro_en).toBe('Created by e2e manual create flow.')
      expect(Array.isArray(gameScalar?.tags)).toBeTruthy()
      expect(gameScalar.tags).toContain('manual-create')
    } finally {
      await deleteAdminGame(request, authHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })
})

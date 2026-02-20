import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

test.describe('Favorite api flow', () => {
  test('should support create/update/delete favorite and add/update/remove favorite item', async ({
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const authHeaders = { cookie: authCookies.cookieHeader }

    const initialFavorites = await expectApiSuccess(
      await request.get('/api/favorites', {
        headers: authHeaders,
      }),
    )
    expect(Array.isArray(initialFavorites)).toBeTruthy()
    const defaultFavorite = initialFavorites.find(favorite => favorite?.default)
    expect(defaultFavorite).toBeDefined()

    const attemptDeleteDefaultResponse = await request.delete(
      `/api/favorites/${defaultFavorite.id}`,
      {
        headers: authHeaders,
      },
    )
    expect(attemptDeleteDefaultResponse.status()).toBeGreaterThanOrEqual(400)
    const attemptDeleteDefaultPayload = await attemptDeleteDefaultResponse.json()
    expect(attemptDeleteDefaultPayload?.code).not.toBe(0)

    const createdFavoriteName = `e2e-favorite-${Date.now()}`
    const createdFavorite = await expectApiSuccess(
      await request.post('/api/favorites', {
        headers: authHeaders,
        data: {
          name: createdFavoriteName,
          description: 'Created by e2e flow test',
          is_private: false,
        },
      }),
    )
    expect(createdFavorite?.id).toBeDefined()

    const favoriteId = createdFavorite.id
    const secondaryGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.secondary.title)

    await expectApiSuccess(
      await request.put(`/api/favorites/${favoriteId}`, {
        headers: authHeaders,
        data: {
          game_id: secondaryGameId,
          note: 'Initial e2e note',
        },
      }),
    )

    await expectApiSuccess(
      await request.patch(`/api/favorites/${favoriteId}`, {
        headers: authHeaders,
        data: {
          name: `${createdFavoriteName}-updated`,
          description: 'Updated by e2e flow test',
          is_private: true,
        },
      }),
    )

    const favoriteItems = await expectApiSuccess(
      await request.get(`/api/favorites/${favoriteId}/items?page=1&pageSize=20`, {
        headers: authHeaders,
      }),
    )
    expect(Array.isArray(favoriteItems?.items)).toBeTruthy()
    const createdItem = favoriteItems.items.find(item => item?.game?.id === secondaryGameId)
    expect(createdItem).toBeDefined()

    await expectApiSuccess(
      await request.patch(`/api/favorites/items/${createdItem.id}`, {
        headers: authHeaders,
        data: {
          note: 'Updated e2e note',
        },
      }),
    )

    const favoriteItemsAfterUpdate = await expectApiSuccess(
      await request.get(`/api/favorites/${favoriteId}/items?page=1&pageSize=20`, {
        headers: authHeaders,
      }),
    )
    const updatedItem = favoriteItemsAfterUpdate.items.find(item => item?.id === createdItem.id)
    expect(updatedItem?.note).toBe('Updated e2e note')

    await expectApiSuccess(
      await request.delete(`/api/favorites/${favoriteId}/games/${secondaryGameId}`, {
        headers: authHeaders,
      }),
    )

    const favoriteItemsAfterDelete = await expectApiSuccess(
      await request.get(`/api/favorites/${favoriteId}/items?page=1&pageSize=20`, {
        headers: authHeaders,
      }),
    )
    expect(favoriteItemsAfterDelete.items.some(item => item?.game?.id === secondaryGameId)).toBe(
      false,
    )

    await expectApiSuccess(
      await request.delete(`/api/favorites/${favoriteId}`, {
        headers: authHeaders,
      }),
    )

    const finalFavorites = await expectApiSuccess(
      await request.get('/api/favorites', {
        headers: authHeaders,
      }),
    )
    expect(finalFavorites.some(favorite => favorite?.id === favoriteId)).toBe(false)
  })
})

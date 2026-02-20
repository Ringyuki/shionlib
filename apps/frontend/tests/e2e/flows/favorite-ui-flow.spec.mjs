import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  ensureUiLoggedIn,
  findGameIdByTitle,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const getCurrentUser = async (request, authHeaders) => {
  return expectApiSuccess(
    await request.get('/api/user/me', {
      headers: authHeaders,
    }),
  )
}

const getFavorites = async (request, authHeaders) => {
  return expectApiSuccess(
    await request.get('/api/favorites', {
      headers: authHeaders,
    }),
  )
}

const getFavoriteItems = async (request, authHeaders, favoriteId) => {
  const data = await expectApiSuccess(
    await request.get(`/api/favorites/${favoriteId}/items?page=1&pageSize=50`, {
      headers: authHeaders,
    }),
  )
  return Array.isArray(data?.items) ? data.items : []
}

test.describe('Favorite ui flow', () => {
  test('should create/edit/delete folder and toggle game membership via real UI actions', async ({
    page,
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const authHeaders = { cookie: authCookies.cookieHeader }
    const currentUser = await getCurrentUser(request, authHeaders)
    const userId = currentUser.id
    const initialFavorites = await getFavorites(request, authHeaders)
    const defaultFavorite = initialFavorites.find(favorite => favorite?.default)
    expect(defaultFavorite?.id).toBeDefined()
    const toggleFavoriteId = defaultFavorite.id
    const targetGameId = await findGameIdByTitle(request, E2E_FIXTURES.games.secondary.title)

    await applyAuthCookiesToPageContext(page, authCookies)

    const createdFavoriteName = `e2e${String(Date.now()).slice(-6)}`
    const updatedFavoriteName = `u${String(Date.now()).slice(-6)}`
    let createdFavoriteId = null

    try {
      await page.goto(`/en/user/${userId}/favorites`)

      await page.getByTestId('favorite-create-trigger').first().click()
      const createDialog = page.getByTestId('favorite-create-dialog')
      await expect(createDialog).toBeVisible()

      await page.getByTestId('favorite-create-name-input').fill(createdFavoriteName)
      await page
        .getByTestId('favorite-create-description-input')
        .fill('Created by e2e favorite ui flow.')
      await page.getByTestId('favorite-create-private-checkbox').click()
      const createResponsePromise = page.waitForResponse(response => {
        return (
          response.request().method() === 'POST' &&
          response.url().includes('/api/favorites') &&
          response.status() < 400
        )
      })
      await page.getByTestId('favorite-create-submit').click()
      const createResponse = await createResponsePromise
      const createPayload = await createResponse.json()
      expect(createPayload?.code).toBe(0)
      expect(createPayload?.data?.id).toBeDefined()
      createdFavoriteId = createPayload.data.id
      await expect(createDialog).toBeHidden()

      const createdSidebarItem = page.getByTestId(`favorite-sidebar-item-${createdFavoriteId}`)
      await expect(createdSidebarItem).toBeVisible()
      await createdSidebarItem.click()

      await expect(page).toHaveURL(new RegExp(`/en/user/${userId}/favorites\\?.*folder=`))
      await expect(page.getByTestId(`favorite-items-header-${createdFavoriteId}`)).toBeVisible()

      await page.getByTestId(`favorite-edit-trigger-${createdFavoriteId}`).click()
      const editDialog = page.getByTestId(`favorite-edit-dialog-${createdFavoriteId}`)
      await expect(editDialog).toBeVisible()

      await page
        .getByTestId(`favorite-edit-name-input-${createdFavoriteId}`)
        .fill(updatedFavoriteName)
      await page
        .getByTestId(`favorite-edit-description-input-${createdFavoriteId}`)
        .fill('Updated by e2e favorite ui flow.')
      const editResponsePromise = page.waitForResponse(response => {
        return (
          response.request().method() === 'PATCH' &&
          response.url().includes(`/api/favorites/${createdFavoriteId}`) &&
          response.status() < 400
        )
      })
      await page.getByTestId(`favorite-edit-submit-${createdFavoriteId}`).click()
      const editResponse = await editResponsePromise
      const editPayload = await editResponse.json()
      expect(editPayload?.code).toBe(0)
      await expect(editDialog).toBeHidden()

      const favoritesAfterEdit = await getFavorites(request, authHeaders)
      const updatedFavorite = favoritesAfterEdit.find(
        favorite => favorite?.id === createdFavoriteId,
      )
      expect(updatedFavorite?.name).toBe(updatedFavoriteName)

      await page.goto(`/en/game/${targetGameId}`)
      await ensureUiLoggedIn(
        page,
        E2E_FIXTURES.users.login.identifier,
        E2E_FIXTURES.users.login.password,
      )
      const favoriteTrigger = page.getByTestId(`game-favorite-trigger-${targetGameId}`).last()
      await expect(favoriteTrigger).toBeVisible()
      await favoriteTrigger.click()

      const favoriteToggle = page.getByTestId(`game-favorite-item-toggle-${toggleFavoriteId}`)
      await expect(favoriteToggle).toBeVisible()

      const addPromise = page.waitForResponse(response => {
        return (
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/favorites/${toggleFavoriteId}`) &&
          response.status() < 400
        )
      })
      await favoriteToggle.click()
      await addPromise

      const itemsAfterAdd = await getFavoriteItems(request, authHeaders, toggleFavoriteId)
      expect(itemsAfterAdd.some(item => item?.game?.id === targetGameId)).toBe(true)

      const removePromise = page.waitForResponse(response => {
        return (
          response.request().method() === 'DELETE' &&
          response.url().includes(`/api/favorites/${toggleFavoriteId}/games/${targetGameId}`) &&
          response.status() < 400
        )
      })
      await favoriteToggle.click()
      await removePromise

      const itemsAfterRemove = await getFavoriteItems(request, authHeaders, toggleFavoriteId)
      expect(itemsAfterRemove.some(item => item?.game?.id === targetGameId)).toBe(false)

      await page.goto(`/en/user/${userId}/favorites?folder=${createdFavoriteId}`)
      await expect(page.getByTestId(`favorite-delete-trigger-${createdFavoriteId}`)).toBeVisible()
      await page.getByTestId(`favorite-delete-trigger-${createdFavoriteId}`).click()
      await expect(page.getByTestId(`favorite-delete-dialog-${createdFavoriteId}`)).toBeVisible()
      await page.getByTestId(`favorite-delete-confirm-${createdFavoriteId}`).click()

      await expect(page.getByTestId(`favorite-sidebar-item-${createdFavoriteId}`)).toHaveCount(0)

      const finalFavorites = await getFavorites(request, authHeaders)
      expect(finalFavorites.some(favorite => favorite?.id === createdFavoriteId)).toBe(false)
      createdFavoriteId = null
    } finally {
      if (createdFavoriteId) {
        await request.delete(`/api/favorites/${createdFavoriteId}`, {
          headers: authHeaders,
        })
      }
    }
  })
})

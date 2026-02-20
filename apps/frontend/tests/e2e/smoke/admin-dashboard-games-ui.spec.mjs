import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const getAdminGameStatus = async (request, adminAuth, gameId) => {
  const data = await expectApiSuccess(
    await request.get('/api/admin/content/games?page=1&pageSize=50&sortBy=id&sortOrder=asc', {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
    }),
  )

  const game = data?.items?.find(item => item?.id === gameId)
  expect(game).toBeDefined()
  expect(typeof game.status).toBe('number')
  return game.status
}

const createTemporaryGame = async (request, adminAuth, title) => {
  const data = await expectApiSuccess(
    await request.post('/api/game/create/game', {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
      data: {
        title_en: title,
        intro_en: 'Temporary game for admin delete e2e.',
        tags: ['e2e'],
        platform: ['pc'],
      },
    }),
  )

  const gameId = Number(data)
  expect(Number.isInteger(gameId)).toBeTruthy()
  return gameId
}

const updateAdminGameStatus = async (request, adminAuth, gameId, status) => {
  await expectApiSuccess(
    await request.patch(`/api/admin/content/games/${gameId}/status`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
      data: {
        status,
      },
    }),
  )
}

const deleteAdminGameById = async (request, adminAuth, gameId) => {
  return await request.delete(`/api/admin/content/games/${gameId}`, {
    headers: {
      cookie: adminAuth.cookieHeader,
    },
  })
}

const waitForAdminGameStatus = async (
  request,
  adminAuth,
  gameId,
  expectedStatus,
  timeoutMs = 10_000,
) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const currentStatus = await getAdminGameStatus(request, adminAuth, gameId)
    if (currentStatus === expectedStatus) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting game status=${expectedStatus}, id=${gameId}`)
}

const getRecentUpdateGameIds = async request => {
  const data = await expectApiSuccess(
    await request.get('/api/game/recent-update?page=1&pageSize=20'),
  )
  if (!Array.isArray(data?.items)) {
    return []
  }
  return data.items.map(item => item.id)
}

const waitForRecentUpdateContainment = async (
  request,
  gameId,
  shouldContain,
  timeoutMs = 10_000,
) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const ids = await getRecentUpdateGameIds(request)
    const contains = ids.includes(gameId)
    if (contains === shouldContain) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error(
    `Timed out waiting game id=${gameId} ${
      shouldContain ? 'to appear in' : 'to disappear from'
    } recent updates`,
  )
}

const waitForAdminGameDeleted = async (request, adminAuth, gameId, timeoutMs = 10_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const response = await request.get(
      '/api/admin/content/games?page=1&pageSize=50&sortBy=id&sortOrder=desc',
      {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      },
    )
    const payload = await response.json()
    if (response.ok() && payload?.code === 0 && Array.isArray(payload?.data?.items)) {
      const exists = payload.data.items.some(item => item?.id === gameId)
      if (!exists) {
        return
      }
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  throw new Error(`Timed out waiting game deletion id=${gameId}`)
}

const findGameRow = async (page, gameId, timeoutMs = 15_000) => {
  const rowByTestId = page.getByTestId(`admin-game-row-${gameId}`).first()
  if ((await rowByTestId.count()) > 0) {
    await expect(rowByTestId).toBeVisible({ timeout: timeoutMs })
    return rowByTestId
  }

  const rowByText = page
    .locator('div.rounded-lg.border.p-4')
    .filter({
      hasText: `ID: ${gameId}`,
    })
    .first()
  await expect(rowByText).toBeVisible({ timeout: timeoutMs })
  return rowByText
}

const openGameActionsMenu = async (page, row, gameId) => {
  const menuLocator = page.getByTestId(`admin-game-actions-menu-${gameId}`).first()
  // Ensure any previously open menu is fully closed before reopening
  await expect(menuLocator)
    .toBeHidden({ timeout: 5_000 })
    .catch(() => {})

  const triggerByTestId = page.getByTestId(`admin-game-actions-trigger-${gameId}`).first()
  if ((await triggerByTestId.count()) > 0) {
    await expect(triggerByTestId).toBeVisible()
    await expect(triggerByTestId).toBeEnabled()
    await triggerByTestId.click()
    await expect(menuLocator).toBeVisible({ timeout: 5_000 })
    return
  }

  const trigger = row.getByRole('button').nth(1)
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByRole('menuitem').first()).toBeVisible()
}

test.describe('Admin dashboard and games UI', () => {
  test('admin dashboard should render stats cards and trend section', async ({ page, request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const response = await page.goto('/en/admin')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/admin$/)
    await expect(page.getByText('Total Games')).toBeVisible()
    await expect(page.getByText('Total Users')).toBeVisible()
    await expect(page.getByText('Activity Trends')).toBeVisible()
  })

  test('admin games page should support sidebar navigation and search filtering', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const response = await page.goto('/en/admin')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await page.getByRole('link', { name: 'Games' }).click()
    await expect(page).toHaveURL(/\/en\/admin\/games(?:\?.*)?$/)

    const searchInput = page.getByPlaceholder('Search by game title')
    await expect(searchInput).toBeVisible()

    const searchKeyword = E2E_FIXTURES.games.primary.title.split(' ')[0]
    const responsePromise = page.waitForResponse(response => {
      const url = response.url()
      return (
        url.includes('/admin/content/games') &&
        url.includes(`search=${encodeURIComponent(searchKeyword)}`)
      )
    })

    await searchInput.fill(searchKeyword)
    await responsePromise

    await expect(page.getByText(E2E_FIXTURES.games.primary.title).first()).toBeVisible()
  })

  test('admin game should support status toggle and restore via actions menu', async ({
    page,
    request,
  }, testInfo) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const title = `E2E Admin Status Toggle ${Date.now()}-${testInfo.workerIndex}`
    const targetGameId = await createTemporaryGame(request, adminAuth, title)
    let deleted = false

    try {
      const initialStatus = await getAdminGameStatus(request, adminAuth, targetGameId)
      const toggledStatus = initialStatus === 1 ? 2 : 1

      const response = await page.goto('/en/admin/games')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      const row = await findGameRow(page, targetGameId)

      const firstToggleLabel = initialStatus === 1 ? 'Hide' : 'Show'
      const firstToggleResponse = page.waitForResponse(res => {
        return (
          res.request().method() === 'PATCH' &&
          res.url().includes(`/admin/content/games/${targetGameId}/status`)
        )
      })
      await openGameActionsMenu(page, row, targetGameId)
      const firstToggleByTestId = page.getByTestId(
        `admin-game-action-toggle-status-${targetGameId}`,
      )
      if ((await firstToggleByTestId.count()) > 0) {
        await firstToggleByTestId.click()
      } else {
        await page.getByRole('menuitem', { name: firstToggleLabel }).click()
      }
      await expectApiSuccess(await firstToggleResponse)
      await waitForAdminGameStatus(request, adminAuth, targetGameId, toggledStatus)

      const restoreLabel = initialStatus === 1 ? 'Show' : 'Hide'
      const restoreResponse = page.waitForResponse(res => {
        return (
          res.request().method() === 'PATCH' &&
          res.url().includes(`/admin/content/games/${targetGameId}/status`)
        )
      })
      await openGameActionsMenu(page, row, targetGameId)
      const restoreByTestId = page.getByTestId(`admin-game-action-toggle-status-${targetGameId}`)
      if ((await restoreByTestId.count()) > 0) {
        await restoreByTestId.click()
      } else {
        await page.getByRole('menuitem', { name: restoreLabel }).click()
      }
      await expectApiSuccess(await restoreResponse)
      await waitForAdminGameStatus(request, adminAuth, targetGameId, initialStatus)
      await deleteAdminGameById(request, adminAuth, targetGameId)
      await waitForAdminGameDeleted(request, adminAuth, targetGameId)
      deleted = true
    } finally {
      if (!deleted) {
        await deleteAdminGameById(request, adminAuth, targetGameId)
      }
    }
  })

  test('admin game should support add/remove recent update via actions menu', async ({
    page,
    request,
  }, testInfo) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const title = `E2E Admin Recent Update ${Date.now()}-${testInfo.workerIndex}`
    const targetGameId = await createTemporaryGame(request, adminAuth, title)
    let deleted = false

    try {
      await expectApiSuccess(
        await request.delete(`/api/admin/content/games/${targetGameId}/recent-update`, {
          headers: {
            cookie: adminAuth.cookieHeader,
          },
        }),
      )
      await waitForRecentUpdateContainment(request, targetGameId, false)

      const response = await page.goto('/en/admin/games')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      const row = await findGameRow(page, targetGameId)

      const addRecentUpdateResponse = page.waitForResponse(res => {
        return (
          res.request().method() === 'PUT' &&
          res.url().includes(`/admin/content/games/${targetGameId}/recent-update`)
        )
      })
      await openGameActionsMenu(page, row, targetGameId)
      const addActionByTestId = page.getByTestId(
        `admin-game-action-add-recent-update-${targetGameId}`,
      )
      if ((await addActionByTestId.count()) > 0) {
        await addActionByTestId.click()
      } else {
        await page.getByRole('menuitem', { name: 'Add To Recent Updates' }).click()
      }
      await expectApiSuccess(await addRecentUpdateResponse)
      await waitForRecentUpdateContainment(request, targetGameId, true)

      const removeRecentUpdateResponse = page.waitForResponse(res => {
        return (
          res.request().method() === 'DELETE' &&
          res.url().includes(`/admin/content/games/${targetGameId}/recent-update`)
        )
      })
      await openGameActionsMenu(page, row, targetGameId)
      const removeActionByTestId = page.getByTestId(
        `admin-game-action-remove-recent-update-${targetGameId}`,
      )
      if ((await removeActionByTestId.count()) > 0) {
        await removeActionByTestId.first().click({ timeout: 5_000 })
      } else {
        await page.getByRole('menuitem', { name: 'Remove From Recent Updates' }).click()
      }
      await expectApiSuccess(await removeRecentUpdateResponse)
      await waitForRecentUpdateContainment(request, targetGameId, false)
      await deleteAdminGameById(request, adminAuth, targetGameId)
      await waitForAdminGameDeleted(request, adminAuth, targetGameId)
      deleted = true
    } finally {
      if (!deleted) {
        await deleteAdminGameById(request, adminAuth, targetGameId)
      }
    }
  })

  test('admin game should support delete via actions menu', async ({ page, request }, testInfo) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const title = `E2E Admin Delete Game ${Date.now()}-${testInfo.workerIndex}`
    const targetGameId = await createTemporaryGame(request, adminAuth, title)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminAuth, targetGameId, 2)
      await waitForAdminGameStatus(request, adminAuth, targetGameId, 2)

      const response = await page.goto('/en/admin/games')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      const row = await findGameRow(page, targetGameId)
      const deleteResponse = page.waitForResponse(res => {
        return (
          res.request().method() === 'DELETE' &&
          res.url().includes(`/api/admin/content/games/${targetGameId}`)
        )
      })

      await openGameActionsMenu(page, row, targetGameId)
      const deleteActionByTestId = page.getByTestId(`admin-game-action-delete-${targetGameId}`)
      if ((await deleteActionByTestId.count()) > 0) {
        await deleteActionByTestId.click()
      } else {
        await page.getByRole('menuitem', { name: 'Delete' }).click()
      }

      const deleteDialogByTestId = page.getByTestId(`admin-game-delete-dialog-${targetGameId}`)
      if ((await deleteDialogByTestId.count()) > 0) {
        await expect(deleteDialogByTestId).toBeVisible()
        await page.getByTestId(`admin-game-delete-confirm-${targetGameId}`).click()
      } else {
        await expect(page.getByRole('heading', { name: 'Delete Game' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Confirm Delete' })).toBeVisible()
        await page.getByRole('button', { name: 'Confirm Delete' }).click()
      }
      await expectApiSuccess(await deleteResponse)

      await waitForAdminGameDeleted(request, adminAuth, targetGameId)
      deleted = true
      await expect(page.getByText(title)).toHaveCount(0)
    } finally {
      if (!deleted) {
        await deleteAdminGameById(request, adminAuth, targetGameId)
      }
    }
  })
})

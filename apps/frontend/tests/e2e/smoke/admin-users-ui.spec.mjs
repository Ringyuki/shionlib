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

const loginStatus = async (request, identifier, password) => {
  const response = await request.post('/api/user/login', {
    data: {
      identifier,
      password,
    },
  })
  return response.status()
}

const resetUserPasswordViaApi = async (request, adminAuth, userId, password) => {
  await expectApiSuccess(
    await request.post(`/api/admin/users/${userId}/reset-password`, {
      data: {
        password,
      },
      headers: {
        cookie: adminAuth.cookieHeader,
      },
    }),
  )
}

const getUserDetail = async (request, adminAuth, userId) => {
  return expectApiSuccess(
    await request.get(`/api/admin/users/${userId}`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
    }),
  )
}

const getUserPermissionsByEntity = async (request, adminAuth, userId, entity) => {
  return expectApiSuccess(
    await request.get(`/api/admin/users/${userId}/permissions?entity=${entity}`, {
      headers: {
        cookie: adminAuth.cookieHeader,
      },
    }),
  )
}

const getAdminUserByIdentifier = async (request, adminAuth, identifier) => {
  const listData = await expectApiSuccess(
    await request.get(
      '/api/admin/users?page=1&pageSize=50&search=' + encodeURIComponent(identifier),
      {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      },
    ),
  )

  const items = Array.isArray(listData?.items) ? listData.items : []
  const exact = items.find(
    item => item.name === identifier || item.email === `${identifier}@shionlib.local`,
  )

  if (!exact) {
    throw new Error(`Admin user not found by identifier: ${identifier}`)
  }

  return exact
}

const waitForUserField = async (request, adminAuth, userId, predicate, timeoutMs = 10_000) => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const detail = await expectApiSuccess(
      await request.get(`/api/admin/users/${userId}`, {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      }),
    )

    if (predicate(detail)) {
      return detail
    }

    await new Promise(resolve => setTimeout(resolve, 400))
  }

  throw new Error(`Timed out waiting for user field update, userId=${userId}`)
}

const openUserActionsMenu = async (page, userId) => {
  const trigger = page.getByTestId(`admin-user-actions-trigger-${userId}`)
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(page.getByTestId(`admin-user-actions-menu-${userId}`)).toBeVisible()
}

const searchUser = async (page, identifier) => {
  const searchInput = page.getByTestId('admin-users-search-input')
  await expect(searchInput).toBeVisible()

  const responsePromise = page.waitForResponse(response => {
    const url = response.url()
    return url.includes('/admin/users') && url.includes(`search=${encodeURIComponent(identifier)}`)
  })

  await searchInput.fill(identifier)
  await responsePromise
}

test.describe('Admin users UI', () => {
  test.describe.configure({ mode: 'serial' })

  test('users page should support search filtering and detail dialog', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const response = await page.goto('/en/admin/users')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/en\/admin\/users(?:\?.*)?$/)

    await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)

    const userRow = page.getByTestId(`admin-user-row-${mutableUser.id}`)
    await expect(userRow).toBeVisible()

    await openUserActionsMenu(page, mutableUser.id)
    await page.getByTestId(`admin-user-action-view-detail-${mutableUser.id}`).click()

    await expect(page.getByTestId(`admin-user-detail-dialog-${mutableUser.id}`)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'User Details' })).toBeVisible()
  })

  test('change role should update mutable user and then restore', async ({ page, request }) => {
    test.setTimeout(90_000)

    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const originalRole = mutableUser.role
    const nextRole = originalRole === 1 ? 2 : 1

    try {
      const response = await page.goto('/en/admin/users')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
      await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-change-role-${mutableUser.id}`).click()

      const dialog = page.getByTestId(`admin-user-change-role-dialog-${mutableUser.id}`)
      await expect(dialog).toBeVisible()

      await page.getByTestId(`admin-user-change-role-select-trigger-${mutableUser.id}`).click()
      const roleLabel = nextRole === 2 ? 'Admin' : 'User'
      await page.getByRole('option', { name: new RegExp(`^${roleLabel}$`) }).click()

      await page.getByTestId(`admin-user-change-role-confirm-${mutableUser.id}`).click()

      await waitForUserField(request, adminAuth, mutableUser.id, detail => detail.role === nextRole)
    } finally {
      try {
        await request.patch(`/api/admin/users/${mutableUser.id}/role`, {
          data: { role: originalRole },
          headers: {
            cookie: adminAuth.cookieHeader,
          },
        })
        await waitForUserField(
          request,
          adminAuth,
          mutableUser.id,
          detail => detail.role === originalRole,
        )
      } catch (error) {
        console.warn('Failed to restore mutable user role in cleanup', error)
      }
    }
  })

  test('ban and unban should update mutable user status', async ({ page, request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    if (mutableUser.status === 2) {
      await expectApiSuccess(
        await request.post(`/api/admin/users/${mutableUser.id}/unban`, {
          headers: {
            cookie: adminAuth.cookieHeader,
          },
        }),
      )
      await waitForUserField(request, adminAuth, mutableUser.id, detail => detail.status === 1)
    }

    try {
      const response = await page.goto('/en/admin/users')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
      await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-ban-${mutableUser.id}`).click()

      await expect(page.getByTestId(`admin-user-ban-dialog-${mutableUser.id}`)).toBeVisible()
      await page
        .getByTestId(`admin-user-ban-reason-input-${mutableUser.id}`)
        .fill('e2e admin user ban flow')
      await page.getByTestId(`admin-user-ban-confirm-${mutableUser.id}`).click()

      await waitForUserField(request, adminAuth, mutableUser.id, detail => detail.status === 2)

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-unban-${mutableUser.id}`).click()

      await expect(page.getByTestId(`admin-user-unban-dialog-${mutableUser.id}`)).toBeVisible()
      await page.getByTestId(`admin-user-unban-confirm-${mutableUser.id}`).click()

      await waitForUserField(request, adminAuth, mutableUser.id, detail => detail.status === 1)
    } finally {
      await request.post(`/api/admin/users/${mutableUser.id}/unban`, {
        headers: {
          cookie: adminAuth.cookieHeader,
        },
      })
      await waitForUserField(request, adminAuth, mutableUser.id, detail => detail.status === 1)
    }
  })

  test('detail dialog should render active sessions for mutable user', async ({
    page,
    request,
  }) => {
    await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.adminOps.identifier,
      E2E_FIXTURES.users.adminOps.password,
    )

    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const response = await page.goto('/en/admin/users')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
    await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

    await openUserActionsMenu(page, mutableUser.id)
    await page.getByTestId(`admin-user-action-view-detail-${mutableUser.id}`).click()

    const detailDialog = page.getByTestId(`admin-user-detail-dialog-${mutableUser.id}`)
    await expect(detailDialog).toBeVisible()
    await expect(detailDialog.getByText('Sessions', { exact: true })).toBeVisible()
    await expect(detailDialog.getByText(/Session:\s*\d+/).first()).toBeVisible()
  })

  test('permissions dialog should read and update mutable permissions', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const entities = ['game', 'character', 'developer']
    let targetEntity = null
    let originalPermissions = null
    let mutableGroup = null
    for (const entity of entities) {
      const detail = await getUserPermissionsByEntity(request, adminAuth, mutableUser.id, entity)
      const candidate = detail.groups.find(group => group.mutable)
      if (candidate) {
        targetEntity = entity
        originalPermissions = detail
        mutableGroup = candidate
        break
      }
    }

    test.skip(!targetEntity || !originalPermissions || !mutableGroup, 'No mutable permission group')

    const targetBit = mutableGroup.bitIndex
    const targetNextEnabled = !mutableGroup.enabled
    const mutableGroupIndex = originalPermissions.groups.findIndex(
      group => group.bitIndex === targetBit,
    )
    const originalAllowBits = originalPermissions.groups
      .filter(group => group.mutable && group.enabled)
      .map(group => group.bitIndex)

    try {
      const response = await page.goto('/en/admin/users')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
      await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-edit-permissions-${mutableUser.id}`).click()
      const permissionsDialog = page.getByRole('dialog').filter({ hasText: 'Edit Permissions' })
      await expect(permissionsDialog).toBeVisible()

      const tabLabelMap = {
        game: 'Game',
        character: 'Character',
        developer: 'Developer',
      }
      await permissionsDialog.getByRole('tab', { name: tabLabelMap[targetEntity] }).click()
      await permissionsDialog.getByRole('checkbox').nth(mutableGroupIndex).click()
      await permissionsDialog.getByRole('button', { name: 'Save' }).click()

      const startedAt = Date.now()
      let latestEnabled = mutableGroup.enabled
      while (Date.now() - startedAt < 10_000) {
        const detail = await getUserPermissionsByEntity(
          request,
          adminAuth,
          mutableUser.id,
          targetEntity,
        )
        const group = detail.groups.find(item => item.bitIndex === targetBit)
        latestEnabled = Boolean(group?.enabled)
        if (latestEnabled === targetNextEnabled) break
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      expect(latestEnabled).toBe(targetNextEnabled)
    } finally {
      await expectApiSuccess(
        await request.patch(`/api/admin/users/${mutableUser.id}/permissions`, {
          data: {
            entity: targetEntity,
            allowBits: originalAllowBits,
          },
          headers: {
            cookie: adminAuth.cookieHeader,
          },
        }),
      )
    }
  })

  test('quota dialog should update and reset mutable user quota', async ({ page, request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const originalDetail = await getUserDetail(request, adminAuth, mutableUser.id)
    const originalSize = BigInt(originalDetail.upload_quota?.size ?? '0')
    const amountBytes = Math.round(0.1 * 1024 ** 3)
    const amountBytesBigInt = BigInt(amountBytes)

    try {
      const response = await page.goto('/en/admin/users')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
      await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-manage-quota-${mutableUser.id}`).click()
      const quotaDialog = page.getByRole('dialog').filter({ hasText: 'Upload Quota' })
      await expect(quotaDialog).toBeVisible()

      await quotaDialog.getByPlaceholder('Reason (optional)').fill('e2e quota update')
      await quotaDialog.getByPlaceholder('Amount (GB)').nth(0).fill('0.1')
      await quotaDialog.getByRole('button', { name: 'Add' }).click()

      await waitForUserField(
        request,
        adminAuth,
        mutableUser.id,
        detail => BigInt(detail.upload_quota?.size ?? '0') >= originalSize + amountBytesBigInt,
      )

      await quotaDialog.getByPlaceholder('Amount (GB)').nth(1).fill('0.1')
      await quotaDialog.getByRole('button', { name: 'Increase used' }).click()
      await waitForUserField(
        request,
        adminAuth,
        mutableUser.id,
        detail => BigInt(detail.upload_quota?.used ?? '0') >= amountBytesBigInt,
      )

      await quotaDialog.getByRole('button', { name: 'Reset used' }).click()
      await waitForUserField(
        request,
        adminAuth,
        mutableUser.id,
        detail => BigInt(detail.upload_quota?.used ?? '0') === 0n,
      )
    } finally {
      const latestDetail = await getUserDetail(request, adminAuth, mutableUser.id)
      const latestSize = BigInt(latestDetail.upload_quota?.size ?? '0')
      const delta = latestSize - originalSize

      if (delta > 0n) {
        await expectApiSuccess(
          await request.patch(`/api/admin/users/${mutableUser.id}/quota/size`, {
            data: {
              action: 'SUB',
              amount: Number(delta),
            },
            headers: {
              cookie: adminAuth.cookieHeader,
            },
          }),
        )
      }

      await expectApiSuccess(
        await request.post(`/api/admin/users/${mutableUser.id}/quota/reset-used`, {
          headers: {
            cookie: adminAuth.cookieHeader,
          },
        }),
      )
    }
  })

  test('reset password and force logout should take effect for mutable user', async ({
    page,
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    await applyAuthCookiesToPageContext(page, adminAuth)

    const mutableUser = await getAdminUserByIdentifier(
      request,
      adminAuth,
      E2E_FIXTURES.users.adminOps.identifier,
    )

    const originalPassword = E2E_FIXTURES.users.adminOps.password
    const newPassword = 'ShionlibE2E456!'

    try {
      const response = await page.goto('/en/admin/users')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await searchUser(page, E2E_FIXTURES.users.adminOps.identifier)
      await expect(page.getByTestId(`admin-user-row-${mutableUser.id}`)).toBeVisible()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-reset-password-${mutableUser.id}`).click()

      const resetDialog = page.getByTestId(`admin-user-reset-password-dialog-${mutableUser.id}`)
      await expect(resetDialog).toBeVisible()
      await resetDialog.getByPlaceholder('New password').fill(newPassword)
      await resetDialog.getByPlaceholder('Confirm password').fill(newPassword)
      await page.getByTestId(`admin-user-reset-password-confirm-${mutableUser.id}`).click()

      await expect(resetDialog).not.toBeVisible()

      const oldPasswordStatus = await loginStatus(
        request,
        E2E_FIXTURES.users.adminOps.identifier,
        originalPassword,
      )
      expect(oldPasswordStatus).toBe(401)

      const mutableAuth = await loginAndExtractAuthCookies(
        request,
        E2E_FIXTURES.users.adminOps.identifier,
        newPassword,
      )
      const mutableMeBeforeForceLogout = await request.get('/api/user/me', {
        headers: {
          cookie: mutableAuth.cookieHeader,
        },
      })
      expect(mutableMeBeforeForceLogout.ok()).toBeTruthy()

      await openUserActionsMenu(page, mutableUser.id)
      await page.getByTestId(`admin-user-action-force-logout-${mutableUser.id}`).click()
      await expect(
        page.getByTestId(`admin-user-force-logout-dialog-${mutableUser.id}`),
      ).toBeVisible()
      await page.getByTestId(`admin-user-force-logout-confirm-${mutableUser.id}`).click()

      const startedAt = Date.now()
      let status = 200
      while (Date.now() - startedAt < 10_000) {
        const meResponse = await request.get('/api/user/me', {
          headers: {
            cookie: mutableAuth.cookieHeader,
          },
        })
        status = meResponse.status()
        if (status === 403 || status === 401) {
          break
        }
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      expect([401, 403]).toContain(status)
    } finally {
      await resetUserPasswordViaApi(request, adminAuth, mutableUser.id, originalPassword)
      const restoredLoginStatus = await loginStatus(
        request,
        E2E_FIXTURES.users.adminOps.identifier,
        originalPassword,
      )
      expect(restoredLoginStatus).toBe(201)
    }
  })
})

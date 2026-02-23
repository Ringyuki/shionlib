import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  ensureUiLoggedIn,
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

test.describe('User settings password UI flow', () => {
  test('should update password from personal settings and remain recoverable', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)

    const mutableIdentifier = E2E_FIXTURES.users.mutable.identifier
    const originalPassword = E2E_FIXTURES.users.mutable.password
    const updatedPassword = 'ShionlibE2E789!'

    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      mutableIdentifier,
      originalPassword,
    )
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const me = await expectApiSuccess(
      await request.get('/api/user/me', {
        headers: {
          cookie: mutableAuth.cookieHeader,
        },
      }),
    )
    const mutableUserId = me.id

    await applyAuthCookiesToPageContext(page, mutableAuth)

    try {
      const response = await page.goto('/en/user/settings/security')
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()

      await ensureUiLoggedIn(page, mutableIdentifier, originalPassword)
      await expect(page).toHaveURL(/\/en\/user\/settings\/security$/)
      await expect(page.getByTestId('settings-password-card')).toBeVisible()

      await page.getByTestId('settings-password-current-input').fill(originalPassword)
      await page.getByTestId('settings-password-new-input').fill(updatedPassword)
      await page.getByTestId('settings-password-confirm-input').fill(updatedPassword)

      const updateResponsePromise = page.waitForResponse(res => {
        return (
          res.request().method() === 'POST' &&
          res.url().includes('/api/user/info/password') &&
          res.status() < 400
        )
      })
      await page.getByTestId('settings-password-update').click()
      const updateResponse = await updateResponsePromise
      const updatePayload = await updateResponse.json()
      expect(updatePayload?.code).toBe(0)

      await expect
        .poll(async () => loginStatus(request, mutableIdentifier, originalPassword))
        .toBe(401)
      await expect
        .poll(async () => loginStatus(request, mutableIdentifier, updatedPassword))
        .toBe(201)
    } finally {
      await resetUserPasswordViaApi(request, adminAuth, mutableUserId, originalPassword)
      await expect
        .poll(async () => loginStatus(request, mutableIdentifier, originalPassword))
        .toBe(201)
    }
  })
})

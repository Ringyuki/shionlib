import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

test.describe('Auth RBAC matrix', () => {
  test('admin endpoint should enforce guest/user/admin access levels', async ({ request }) => {
    const endpoint = '/api/admin/stats/overview'

    const guestResponse = await request.get(endpoint)
    expect(guestResponse.status()).toBe(401)

    const userCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const userResponse = await request.get(endpoint, {
      headers: {
        cookie: userCookies.cookieHeader,
      },
    })
    expect(userResponse.status()).toBe(403)

    const userLogoutResponse = await request.post('/api/auth/logout', {
      headers: {
        cookie: userCookies.cookieHeader,
      },
    })
    expect(userLogoutResponse.ok()).toBeTruthy()

    const adminCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const adminResponse = await request.get(endpoint, {
      headers: {
        cookie: adminCookies.cookieHeader,
      },
    })
    expect(adminResponse.ok()).toBeTruthy()

    const adminPayload = await adminResponse.json()
    expect(adminPayload?.code).toBe(0)
  })
})

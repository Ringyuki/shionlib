import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  getSetCookieHeaders,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

test.describe('Auth login/logout', () => {
  test('login should establish session and logout should invalidate it', async ({ request }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    expect(authCookies.accessToken).toBeTruthy()
    expect(authCookies.refreshToken).toBeTruthy()

    const meResponse = await request.get('/api/user/me', {
      headers: {
        cookie: authCookies.cookieHeader,
      },
    })
    expect(meResponse.ok()).toBeTruthy()
    const mePayload = await meResponse.json()
    expect(mePayload?.code).toBe(0)
    expect(mePayload?.data?.name).toBe(E2E_FIXTURES.users.login.identifier)

    const logoutResponse = await request.post('/api/auth/logout', {
      headers: {
        cookie: authCookies.cookieHeader,
      },
    })
    expect(logoutResponse.ok()).toBeTruthy()
    const logoutSetCookies = getSetCookieHeaders(logoutResponse)
    expect(
      logoutSetCookies.some(cookie => cookie.startsWith('shionlib_access_token=;')),
    ).toBeTruthy()
    expect(
      logoutSetCookies.some(cookie => cookie.startsWith('shionlib_refresh_token=;')),
    ).toBeTruthy()

    const meAfterLogoutResponse = await request.get('/api/user/me')
    expect(meAfterLogoutResponse.status()).toBe(401)
  })
})

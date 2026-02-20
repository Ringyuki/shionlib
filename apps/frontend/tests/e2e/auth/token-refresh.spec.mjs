import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  getSetCookieHeaders,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const readCookieValueFromSetCookie = (setCookie, name) => {
  const [pair] = setCookie.split(';')
  const separatorIndex = pair.indexOf('=')
  if (separatorIndex === -1) {
    return null
  }

  const cookieName = pair.slice(0, separatorIndex).trim()
  if (cookieName !== name) {
    return null
  }

  return pair.slice(separatorIndex + 1)
}

const findCookieValueInSetCookies = (setCookies, cookieName) => {
  for (const setCookie of setCookies) {
    const value = readCookieValueFromSetCookie(setCookie, cookieName)
    if (value !== null) {
      return value
    }
  }
  throw new Error(`Missing ${cookieName} from Set-Cookie headers`)
}

test.describe('Auth token refresh api', () => {
  test('should refresh tokens with valid refresh token and reject invalid refresh token', async ({
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )

    const refreshResponse = await request.post('/api/auth/token/refresh', {
      headers: {
        cookie: authCookies.cookieHeader,
      },
    })
    expect(refreshResponse.ok()).toBeTruthy()

    const refreshSetCookies = getSetCookieHeaders(refreshResponse)
    const refreshedAccessToken = findCookieValueInSetCookies(
      refreshSetCookies,
      'shionlib_access_token',
    )
    const refreshedRefreshToken = findCookieValueInSetCookies(
      refreshSetCookies,
      'shionlib_refresh_token',
    )
    expect(refreshedAccessToken).toBeTruthy()
    expect(refreshedRefreshToken).toBeTruthy()

    const refreshedCookieHeader = `shionlib_access_token=${refreshedAccessToken}; shionlib_refresh_token=${refreshedRefreshToken}`
    const meResponse = await request.get('/api/user/me', {
      headers: {
        cookie: refreshedCookieHeader,
      },
    })
    expect(meResponse.ok()).toBeTruthy()
    const mePayload = await meResponse.json()
    expect(mePayload?.code).toBe(0)
    expect(mePayload?.data?.name).toBe(E2E_FIXTURES.users.login.identifier)

    const invalidRefreshResponse = await request.post('/api/auth/token/refresh', {
      headers: {
        cookie: 'shionlib_refresh_token=invalid.refresh.token',
      },
    })
    expect(invalidRefreshResponse.status()).toBeGreaterThanOrEqual(400)
    const invalidRefreshPayload = await invalidRefreshResponse.json()
    expect(invalidRefreshPayload?.code).not.toBe(0)
  })
})

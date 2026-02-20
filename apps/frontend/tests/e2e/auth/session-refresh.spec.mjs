import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

const resolveCookieScope = () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
  const origin = new URL(baseUrl)
  return {
    domain: origin.hostname,
    secure: origin.protocol === 'https:',
  }
}

const applyArbitraryAuthCookies = async (page, auth) => {
  const { domain, secure } = resolveCookieScope()
  const cookies = []

  if (auth.accessToken !== undefined) {
    cookies.push({
      name: 'shionlib_access_token',
      value: auth.accessToken,
      domain,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
    })
  }
  if (auth.refreshToken !== undefined) {
    cookies.push({
      name: 'shionlib_refresh_token',
      value: auth.refreshToken,
      domain,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
    })
  }

  if (cookies.length > 0) {
    await page.context().addCookies(cookies)
  }
}

const resolveMeStatus = page =>
  page.evaluate(async () => {
    const response = await fetch('/api/user/me', {
      credentials: 'include',
    })
    return response.status
  })

test.describe('Auth refresh scenarios', () => {
  test('SSR should recover when access token is missing but refresh token is valid', async ({
    page,
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )

    await applyArbitraryAuthCookies(page, {
      refreshToken: authCookies.refreshToken,
    })

    const response = await page.goto('/en/user/settings/personal')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/user\/settings\/personal$/)
    await expect.poll(() => resolveMeStatus(page)).toBe(200)
    await expect(page.getByText('Login Required')).toHaveCount(0)
  })

  test('SSR should recover when access token payload/header is corrupted', async ({
    page,
    request,
  }) => {
    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )

    await applyArbitraryAuthCookies(page, {
      accessToken: 'invalid.payload.signature',
      refreshToken: authCookies.refreshToken,
    })

    const response = await page.goto('/en/user/settings/personal')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/user\/settings\/personal$/)
    await expect.poll(() => resolveMeStatus(page)).toBe(200)
    await expect(page.getByText('Login Required')).toHaveCount(0)
  })

  test('store should auto-logout when both access and refresh are invalid', async ({ page }) => {
    await applyArbitraryAuthCookies(page, {
      accessToken: 'invalid.payload.signature',
      refreshToken: 'invalid.refresh.token',
    })

    const response = await page.goto('/en/user/settings/personal')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/en\/user\/settings\/personal$/)
    await expect(page.getByText('Login Required')).toBeVisible()
    await expect.poll(() => resolveMeStatus(page)).toBe(401)
  })
})

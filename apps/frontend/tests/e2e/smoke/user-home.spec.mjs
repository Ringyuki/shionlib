import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const loginAndGetCurrentUser = async request => {
  const authCookies = await loginAndExtractAuthCookies(
    request,
    E2E_FIXTURES.users.login.identifier,
    E2E_FIXTURES.users.login.password,
  )

  const meResponse = await request.get('/api/user/me', {
    headers: {
      cookie: authCookies.cookieHeader,
    },
  })
  if (!meResponse.ok()) {
    throw new Error(`Failed to load current user after login: ${meResponse.status()}`)
  }

  const mePayload = await meResponse.json()
  if (mePayload?.code !== 0 || !mePayload?.data?.id) {
    throw new Error('Unexpected /api/user/me payload while resolving user id.')
  }

  return {
    user: mePayload.data,
    authCookies,
  }
}

test.describe('User home pages', () => {
  test('user home routes should render profile and tab pages', async ({ page, request }) => {
    const { user: currentUser, authCookies } = await loginAndGetCurrentUser(request)
    await applyAuthCookiesToPageContext(page, authCookies)

    const userId = currentUser.id
    const userName = currentUser.name

    await page.goto(`/en/user/${userId}`)
    await expect(page).toHaveURL(new RegExp(`/en/user/${userId}/uploads$`))
    await expect(page.getByText(userName).first()).toBeVisible()

    const tabRoutes = ['uploads', 'comments', 'favorites', 'edits']
    for (const tab of tabRoutes) {
      const response = await page.goto(`/en/user/${userId}/${tab}`)
      expect(response).not.toBeNull()
      expect(response.ok()).toBeTruthy()
      await expect(page.getByText(userName).first()).toBeVisible()
    }
  })
})

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

const getCurrentUser = async (request, authHeaders) => {
  return expectApiSuccess(
    await request.get('/api/user/me', {
      headers: authHeaders,
    }),
  )
}

const updateNameByApi = async (request, authHeaders, name) => {
  return expectApiSuccess(
    await request.post('/api/user/info/name', {
      headers: authHeaders,
      data: {
        name,
      },
    }),
  )
}

const updateContentLimitByApi = async (request, authHeaders, contentLimit) => {
  return expectApiSuccess(
    await request.post('/api/user/info/content-limit', {
      headers: authHeaders,
      data: {
        content_limit: contentLimit,
      },
    }),
  )
}

const updateLanguageByApi = async (request, authHeaders, lang) => {
  return expectApiSuccess(
    await request.post('/api/user/info/lang', {
      headers: authHeaders,
      data: {
        lang,
      },
    }),
  )
}

test.describe('User settings ui flow', () => {
  test('should update personal/site settings through real UI and restore original values', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)

    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    const authHeaders = {
      cookie: authCookies.cookieHeader,
    }

    const currentUser = await getCurrentUser(request, authHeaders)
    const originalName = currentUser.name
    const originalContentLimit = Number(currentUser.content_limit ?? 1)
    const originalLang = currentUser.lang

    const updatedName = `e2e_u${String(Date.now()).slice(-6)}`
    const targetContentLimit = originalContentLimit === 1 ? 2 : 1
    const targetLang = originalLang === 'en' ? 'zh' : 'en'

    let nameUpdated = false
    let contentLimitUpdated = false
    let langUpdated = false

    await applyAuthCookiesToPageContext(page, authCookies)

    try {
      await page.goto('/en/user/settings/personal')
      await ensureUiLoggedIn(
        page,
        E2E_FIXTURES.users.login.identifier,
        E2E_FIXTURES.users.login.password,
      )

      await expect(page.getByTestId('settings-name-input')).toBeVisible()
      await page.getByTestId('settings-name-input').fill(updatedName)

      const updateNameRequest = page.waitForResponse(response => {
        return (
          response.request().method() === 'POST' &&
          response.url().includes('/api/user/info/name') &&
          response.status() < 400
        )
      })
      await page.getByTestId('settings-name-update').click()
      await updateNameRequest

      const userAfterNameUpdate = await getCurrentUser(request, authHeaders)
      expect(userAfterNameUpdate.name).toBe(updatedName)
      nameUpdated = true

      await page.goto('/en/user/settings/site')
      await ensureUiLoggedIn(
        page,
        E2E_FIXTURES.users.login.identifier,
        E2E_FIXTURES.users.login.password,
      )

      await expect(page.getByTestId('settings-content-limit-select-trigger')).toBeVisible()
      await page.getByTestId('settings-content-limit-select-trigger').click()
      await page.getByTestId(`settings-content-limit-option-${targetContentLimit}`).click()

      const updateContentLimitRequest = page.waitForResponse(response => {
        return (
          response.request().method() === 'POST' &&
          response.url().includes('/api/user/info/content-limit') &&
          response.status() < 400
        )
      })
      await page.getByTestId('settings-content-limit-update').click()
      await updateContentLimitRequest

      const userAfterContentLimitUpdate = await getCurrentUser(request, authHeaders)
      expect(Number(userAfterContentLimitUpdate.content_limit)).toBe(targetContentLimit)
      contentLimitUpdated = true

      await expect(page.getByTestId('settings-language-select-trigger')).toBeVisible()
      await page.getByTestId('settings-language-select-trigger').click()
      await page.getByTestId(`settings-language-option-${targetLang}`).click()

      const updateLanguageRequest = page.waitForResponse(response => {
        return (
          response.request().method() === 'POST' &&
          response.url().includes('/api/user/info/lang') &&
          response.status() < 400
        )
      })
      await page.getByTestId('settings-language-update').click()
      await updateLanguageRequest

      await expect(page).toHaveURL(new RegExp(`/${targetLang}/user/settings/site`))

      const userAfterLanguageUpdate = await getCurrentUser(request, authHeaders)
      expect(userAfterLanguageUpdate.lang).toBe(targetLang)
      langUpdated = true
    } finally {
      if (langUpdated) {
        await updateLanguageByApi(request, authHeaders, originalLang)
      }
      if (contentLimitUpdated) {
        await updateContentLimitByApi(request, authHeaders, originalContentLimit)
      }
      if (nameUpdated) {
        await updateNameByApi(request, authHeaders, originalName)
      }

      const restoredUser = await getCurrentUser(request, authHeaders)
      expect(restoredUser.name).toBe(originalName)
      expect(Number(restoredUser.content_limit)).toBe(originalContentLimit)
      expect(restoredUser.lang).toBe(originalLang)
    }
  })
})

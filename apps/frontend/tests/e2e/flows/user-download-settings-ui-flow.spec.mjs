import { expect, test } from '@playwright/test'
import {
  E2E_FIXTURES,
  applyAuthCookiesToPageContext,
  ensureUiLoggedIn,
  loginAndExtractAuthCookies,
} from '../_helpers/fixtures.mjs'

const replaceInputValue = async (page, input, value) => {
  const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
  await input.click()
  await page.keyboard.press(selectAllShortcut)
  await page.keyboard.type(value)
  await input.blur()
}

test.describe('User download settings UI flow', () => {
  test('should save aria2 settings into local storage and reset to defaults', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000)

    const authCookies = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )
    await applyAuthCookiesToPageContext(page, authCookies)

    const hostValue = `e2e-host-${Date.now()}`
    const portValue = '16800'
    const pathValue = '/e2e-jsonrpc'
    const downloadPathValue = '/tmp/e2e-download-path'

    const response = await page.goto('/en/user/settings/download')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await ensureUiLoggedIn(
      page,
      E2E_FIXTURES.users.login.identifier,
      E2E_FIXTURES.users.login.password,
    )

    await expect(page.getByTestId('settings-aria2-card')).toBeVisible()
    await expect(page.getByTestId('settings-aria2-host-input')).toHaveValue('localhost')
    await page.waitForTimeout(500)

    await page.getByTestId('settings-aria2-protocol-trigger').click()
    await page.getByTestId('settings-aria2-protocol-option-https').click()
    await expect(page.getByTestId('settings-aria2-protocol-trigger')).toContainText('HTTPS')

    await replaceInputValue(page, page.getByTestId('settings-aria2-host-input'), hostValue)
    await replaceInputValue(page, page.getByTestId('settings-aria2-port-input'), portValue)
    await replaceInputValue(page, page.getByTestId('settings-aria2-path-input'), pathValue)
    await replaceInputValue(
      page,
      page.getByTestId('settings-aria2-download-path-input'),
      downloadPathValue,
    )

    await expect(page.getByTestId('settings-aria2-host-input')).toHaveValue(hostValue)
    await expect(page.getByTestId('settings-aria2-port-input')).toHaveValue(portValue)
    await expect(page.getByTestId('settings-aria2-path-input')).toHaveValue(pathValue)
    await expect(page.getByTestId('settings-aria2-download-path-input')).toHaveValue(
      downloadPathValue,
    )

    await page.getByTestId('settings-aria2-save').click()

    await expect
      .poll(async () =>
        page.evaluate(
          ({ host, path, port }) => {
            const snapshot = localStorage.getItem('shionlib-local-settings-store')
            if (!snapshot) return false
            return (
              snapshot.includes(`"host":"${host}"`) &&
              snapshot.includes(`"path":"${path}"`) &&
              snapshot.includes(`"port":${port}`) &&
              snapshot.includes('"protocol":"https"')
            )
          },
          {
            host: hostValue,
            path: pathValue,
            port: Number(portValue),
          },
        ),
      )
      .toBe(true)

    await page.getByTestId('settings-aria2-reset').click()

    await expect(page.getByTestId('settings-aria2-protocol-trigger')).toContainText('HTTP')
    await expect(page.getByTestId('settings-aria2-host-input')).toHaveValue('localhost')
    await expect(page.getByTestId('settings-aria2-port-input')).toHaveValue('6800')
    await expect(page.getByTestId('settings-aria2-path-input')).toHaveValue('/jsonrpc')
    await expect(page.getByTestId('settings-aria2-download-path-input')).toHaveValue('')

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const snapshot = localStorage.getItem('shionlib-local-settings-store')
          if (!snapshot) return false
          return (
            snapshot.includes('"protocol":"http"') &&
            snapshot.includes('"host":"localhost"') &&
            snapshot.includes('"port":6800') &&
            snapshot.includes('"path":"/jsonrpc"')
          )
        }),
      )
      .toBe(true)
  })
})

import { expect, test } from '@playwright/test'

test('knows every route from the first document and asks for none later', async ({ page }) => {
  const discoveries: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/__manifest') {
      discoveries.push(request.url())
    }
  })
  await page.goto('/zh')
  const nav = page.getByRole('navigation', { name: '主导航' })
  await nav.getByRole('link', { name: '游戏库', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/game$/)
  await nav.getByRole('link', { name: '开发商', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/developer$/)
  await page.getByRole('list', { name: '开发商' }).getByRole('link').first().click()
  await expect(page).toHaveURL(/\/zh\/developer\/\d+$/)
  expect(discoveries).toEqual([])
})

test('opens the search palette with the slash key', async ({ page }) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog').getByPlaceholder('搜索游戏、开发商、角色')).toBeFocused()
})

test('keeps recent searches in the palette until they are cleared', async ({ page }) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('/')
  const palette = page.getByRole('dialog')
  const input = palette.getByPlaceholder('搜索游戏、开发商、角色')
  await input.fill('e2e recent term')
  await input.press('Enter')
  await expect(page).toHaveURL(/\/zh\/search\?q=e2e\+recent\+term$/)
  await expect(palette).toBeHidden()
  await page
    .getByRole('banner')
    .getByRole('button', { name: /搜索游戏、开发商、角色/ })
    .click()
  await expect(palette.getByRole('option', { name: 'e2e recent term' })).toBeVisible()
  await palette.getByRole('button', { name: '清除最近搜索' }).click()
  await expect(palette.getByRole('option', { name: 'e2e recent term' })).toHaveCount(0)
  await expect(input).toBeFocused()
})

test('keeps what the palette shows while it closes and starts empty the next time', async ({
  page,
}) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  const opener = page.getByRole('banner').getByRole('button', { name: /搜索游戏、开发商、角色/ })
  await opener.click()
  const palette = page.getByRole('dialog')
  const input = palette.getByPlaceholder('搜索游戏、开发商、角色')
  await input.fill('e2e closing term')
  const shownWhileClosing = page.evaluate(
    () =>
      new Promise<string[]>(resolve => {
        const values = new Set<string>()
        const watch = () => {
          const field = document.querySelector<HTMLInputElement>('[role="dialog"] input')
          if (field === null) {
            resolve([...values])
            return
          }
          values.add(field.value)
          requestAnimationFrame(watch)
        }
        watch()
      }),
  )
  await page.mouse.click(8, 400)
  expect(await shownWhileClosing).toEqual(['e2e closing term'])
  await opener.click()
  await expect(input).toHaveValue('')
})

test('sends the legacy search URL to the search page', async ({ page }) => {
  await page.goto('/zh/search/game?q=Re')
  await expect(page).toHaveURL(/\/zh\/search\?q=Re$/)
})

test('negotiates the language from the root URL', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/zh$/)
})

const pageData = (url: URL) => url.pathname.endsWith('.data')

test('shows a page that cannot be loaded inside the site, and loads it on retry', async ({
  page,
}) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.route(pageData, route => route.abort())
  await page.getByRole('link', { name: '游戏库' }).first().click()
  const main = page.getByRole('main')
  await expect(main.getByText('请求未成功，请稍后再试')).toBeVisible()
  await expect(page.getByRole('link', { name: '游戏库' }).first()).toBeVisible()
  await page.unroute(pageData)
  await main.getByRole('button', { name: '重试' }).click()
  await expect(main.getByRole('button', { name: '重试' })).toHaveCount(0)
  await expect(page).toHaveURL(/\/zh\/game$/)
})

test('shows a bar at the top while a page takes long to load', async ({ page }) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.route('**/*.data*', async route => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.continue()
  })
  const bar = page.getByRole('progressbar', { name: '页面加载中' })
  await expect(bar).toHaveCount(0)
  await page.getByRole('link', { name: '游戏库', exact: true }).first().click()
  await expect(bar).toBeVisible()
  await expect(page).toHaveURL(/\/zh\/game$/)
  await expect(bar).toHaveCount(0)
})

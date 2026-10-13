import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function loadedScreenshots(page: Page) {
  await page.goto('/zh/game/1/info')
  const screenshots = page.getByRole('region', { name: '截图' })
  await screenshots.scrollIntoViewIfNeeded()
  await expect(screenshots.locator('img[src]').first()).toBeVisible()
  return screenshots
}

test('opens on the resources tab with the seeded files', async ({ page }) => {
  await page.goto('/zh/game/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('常轨脱离Creative Re:Re:call')
  await expect(page.getByRole('tab', { name: /资源/ })).toHaveAttribute('aria-selected', 'true')
  const card = page.locator('#resource-1')
  await expect(card.getByText('seeded-reportable-sample.zip')).toBeVisible()
  await expect(card.getByText('Windows')).toBeVisible()
})

test('switches tabs through the URL', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.getByRole('tab', { name: /简介/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/info$/)
  await expect(page.getByRole('region', { name: '简介' })).toBeVisible()
  await page.getByRole('tab', { name: /角色/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/characters$/)
})

test('links catalog tags to the game library', async ({ page }) => {
  await page.goto('/zh/game/1/info')
  const tags = page.getByRole('heading', { name: '标签' }).locator('..')
  const tag = tags.getByRole('link').first()
  await expect(tag).toHaveAttribute('href', /^\/zh\/game\?tag=/)
})

test('hides a resource held for review from visitors', async ({ page }) => {
  await page.goto('/zh/game/3')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText('seeded-malware-sample.zip')).toHaveCount(0)
})

test.describe('as the uploader of the held resource', () => {
  test.use({ storageState: sessionFile('admin') })

  test('blocks the download of the file held for review', async ({ page }) => {
    await page.goto('/zh/game/3')
    const row = page.getByRole('listitem').filter({ hasText: 'seeded-malware-sample.zip' })
    await expect(row).toContainText('等待复核')
    await expect(row.getByRole('button', { name: '下载', exact: true })).toHaveCount(0)
  })
})

test.describe('as a member who has adult pictures masked', () => {
  test.use({ storageState: sessionFile('member') })

  test.beforeEach(async ({ page }) => {
    await page.route(
      url => url.pathname.includes('/game/1/image/'),
      route => route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
    )
  })

  test('shows a masked screenshot first and opens it only once it is shown', async ({ page }) => {
    const screenshots = await loadedScreenshots(page)
    const mask = screenshots.getByRole('button', { name: '成人内容，点击显示' })
    await expect(screenshots.getByRole('button')).toHaveCount(10)
    await expect(mask).toHaveCount(1)
    await mask.click()
    await expect(mask).toHaveCount(0)
    await expect(screenshots.getByRole('button')).toHaveCount(10)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(screenshots.locator('button:focus')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: '游戏截图' })).toBeVisible()
  })

  test('keeps a masked screenshot out of the pictures that are paged through', async ({ page }) => {
    const screenshots = await loadedScreenshots(page)
    const paged = page.getByRole('dialog', { name: '游戏截图' }).locator('img')
    const open = async () => {
      await screenshots.getByRole('button', { name: '游戏截图' }).first().click()
      await expect(paged.first()).toBeVisible()
      const count = await paged.count()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      return count
    }
    const masked = await open()
    await screenshots.getByRole('button', { name: '成人内容，点击显示' }).click()
    expect(await open()).toBe(masked + 1)
  })
})

test.describe('as a member who sees adult pictures', () => {
  test.use({ storageState: sessionFile('admin') })

  test('shows every screenshot without a mask', async ({ page }) => {
    await page.goto('/zh/game/1/info')
    const screenshots = page.getByRole('region', { name: '截图' })
    await expect(screenshots.getByRole('button')).toHaveCount(10)
    await expect(screenshots.getByRole('button', { name: '成人内容，点击显示' })).toHaveCount(0)
  })
})

test('renders the page in the visitor language', async ({ page }) => {
  await page.goto('/en/game/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HAMIDASHI CREATIVE Re:Re:call')
})

test('answers an unknown game with the not-found page, inside the site and with what identifies the failure', async ({
  page,
}) => {
  const response = await page.goto('/zh/game/999999')
  expect(response?.status()).toBe(404)
  const main = page.getByRole('main')
  await expect(main.getByText('页面不存在')).toBeVisible()
  await expect(main.getByText('状态码 404')).toBeVisible()
  await expect(main.getByText(/请求 ID：[0-9a-f-]{36}/)).toBeVisible()
  await expect(page.getByRole('link', { name: '游戏库' }).first()).toBeVisible()
})

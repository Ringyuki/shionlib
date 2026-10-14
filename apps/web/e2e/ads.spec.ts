import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const name = 'E2E 广告'

const link = 'https://e2e.example/ad'

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const folders: Readonly<Record<string, string>> = {
  banner: 'banner',
  'side-image': 'side',
  'side-icon': 'icon',
}

async function stubPictures(page: Page) {
  await page.route(
    url => url.pathname.includes('/spotlight/'),
    route => route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
  )
  await page.route('**/resources/admin/ads/image.data', route => {
    const kind = /name="kind"\r\n\r\n([a-z-]+)/.exec(route.request().postData() ?? '')?.[1] ?? ''
    return route.fulfill({
      status: 200,
      contentType: 'text/x-script',
      body: `[{"_1":2},"data",{"_3":4,"_5":6},"ok",true,"result","spotlight/${folders[kind]}/e2e.webp"]`,
    })
  })
}

function list(page: Page) {
  return page.getByRole('table', { name: '广告' })
}

function row(page: Page) {
  return list(page).getByRole('row', { name: new RegExp(name) })
}

async function choose(page: Page, action: string) {
  await page.getByRole('button', { name: `${name}的操作` }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

function banners(page: Page) {
  return page.getByRole('main').getByRole('complementary', { name: '広告' })
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test.beforeEach(async ({ page }) => {
    await stubPictures(page)
  })

  test('lists the ads and the five slots the pages have', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '广告' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/ads$/)
    await expect(page.getByText('已开启')).toBeVisible()
    await page.getByRole('tab', { name: '广告位' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/ads\/slots$/)
    const slots = page.getByRole('table', { name: '广告位' })
    for (const slot of ['首页', '游戏页', '资源页', '下载验证', '侧栏']) {
      await expect(slots.getByRole('row', { name: new RegExp(`^${slot}`) })).toBeVisible()
    }
    await expect(page.getByText('共 5 个广告位')).toBeVisible()
  })

  test('creates an ad with a banner and a sidebar picture', async ({ page }) => {
    await page.goto('/zh/admin/ads')
    await page.getByRole('button', { name: '新建广告' }).click()
    const dialog = page.getByRole('dialog', { name: '新建广告' })
    await dialog.getByLabel('名称').fill(name)
    await dialog.getByLabel('链接').fill(link)
    await expect(dialog.getByRole('checkbox', { name: '侧栏（需要侧栏图）' })).toBeDisabled()
    await dialog.getByRole('button', { name: '创建' }).click()
    await expectNotice(page, '广告至少需要一张横幅或一张侧栏图')

    const files = dialog.locator('input[type=file]')
    await files.nth(0).setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: pixel })
    await expect(dialog.getByText('更换图片')).toBeVisible()
    await files.nth(1).setInputFiles({ name: 'side.png', mimeType: 'image/png', buffer: pixel })
    await files.nth(2).setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: pixel })
    await expect(dialog.getByText('更换侧栏图')).toBeVisible()
    await expect(dialog.getByText('更换方形图标')).toBeVisible()
    await dialog.getByRole('checkbox', { name: '首页', exact: true }).check()
    await dialog.getByRole('checkbox', { name: '侧栏', exact: true }).check()
    await dialog.getByRole('checkbox', { name: '中文' }).uncheck()
    await dialog.getByRole('checkbox', { name: '日文' }).check()
    await dialog.getByRole('button', { name: '创建' }).click()
    await expectNotice(page, '已创建')
    await expect(dialog).toBeHidden()
    await expect(row(page)).toContainText('首页、侧栏')
    await expect(row(page)).toContainText('日文')
    await expect(row(page)).toContainText('投放中')
  })

  test('shows the ad on pages in its language and counts views and clicks', async ({ page }) => {
    const reported = page.waitForResponse(
      response => response.url().includes('/resources/slot-views') && response.ok(),
    )
    await page.goto('/ja')
    const banner = banners(page).getByRole('link', { name: new RegExp(name) })
    await expect(banner).toBeVisible()
    await expect(banner).toHaveAttribute('href', /^\/out\/\d+\?slot=home$/)
    await expect(banner).toHaveAttribute('rel', 'sponsored noopener')
    await expect(page.getByRole('link', { name: `${name} · 広告` })).toBeVisible()
    await reported

    const out = await banner.getAttribute('href')
    const click = await page.request.get(out ?? '', { maxRedirects: 0 })
    expect(click.status()).toBe(302)
    expect(click.headers().location).toBe(link)

    await page.goto('/zh')
    await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)
    await page.goto('/ja/user/settings/site')
    await expect(page.getByRole('link', { name: `${name} · 広告` })).toHaveCount(0)
  })

  test('opens the report and turns the ad off and on', async ({ page }) => {
    await page.goto('/zh/admin/ads')
    await row(page).click()
    const pane = page.getByRole('dialog', { name })
    await expect(pane.getByText('首页、侧栏')).toBeVisible()
    await expect(pane.getByRole('table', { name: '广告位' })).toContainText('首页')
    await pane.getByRole('button', { name: '近 7 天' }).click()
    await expect(page).toHaveURL(/days=7/)
    await pane.getByRole('button', { name: '停用' }).click()
    await expectNotice(page, '已停用')
    await expect(pane.getByText('已停用', { exact: true })).toBeVisible()
    await page.goto('/ja')
    await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveCount(0)

    await page.goto('/zh/admin/ads')
    await choose(page, '启用')
    await expectNotice(page, '已启用')
    await expect(row(page)).toContainText('投放中')
  })

  test('deletes the ad with its counts', async ({ page }) => {
    await page.goto('/zh/admin/ads')
    await choose(page, '删除')
    const confirm = page.getByRole('alertdialog', { name: `确定要删除「${name}」吗？` })
    await confirm.getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '已删除')
    await expect(row(page)).toHaveCount(0)
  })
})

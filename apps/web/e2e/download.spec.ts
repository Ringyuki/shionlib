import { expect, test, type Page } from '@playwright/test'
import { expectNotice } from './support/notices'

const resource = (page: Page) => page.locator('#resource-1')

async function openMenu(page: Page) {
  await resource(page).getByRole('button', { name: '其他下载方式' }).click()
  return page.getByRole('menu')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.waitForLoadState('networkidle')
})

test('solves the Cap challenge before asking the API for the link', async ({ page }) => {
  const redeemed = page.waitForResponse(
    response => response.url().endsWith('/redeem') && response.request().method() === 'POST',
  )
  const asked = page.waitForRequest(request => request.url().includes('/resources/download/link'))
  await resource(page).getByRole('button', { name: '下载', exact: true }).click()
  expect((await redeemed).status()).toBe(200)
  const sent: unknown = (await asked).postDataJSON()
  expect(sent).toMatchObject({ fileId: 1, token: expect.stringMatching(/^[0-9a-f]+:.+:.+$/) })
  await expectNotice(page, '下载资源文件不存在')
})

test('offers the browser, aria2 and the game managers, and a link to copy', async ({ page }) => {
  const menu = await openMenu(page)
  await expect(menu.getByRole('menuitem')).toHaveText([
    '通过浏览器下载（默认）',
    '推送到 aria2',
    '推送到 LunaBox',
    '推送到 ReinaManager',
    '推送到 PotatoVN',
    '复制下载链接',
    '下载设置',
  ])
})

test('changes the download settings without leaving the page', async ({ page }) => {
  await (await openMenu(page)).getByRole('menuitem', { name: '下载设置' }).click()
  const settings = page.getByRole('dialog', { name: '下载设置' })
  await settings.getByRole('radio', { name: /^推送到 aria2/ }).click()
  await settings.getByRole('switch', { name: '在下载菜单中显示 PotatoVN' }).click()
  await settings.getByRole('button', { name: '完成' }).click()
  await expect(settings).toBeHidden()
  await expect(page).toHaveURL(/\/zh\/game\/1$/)
  const menu = await openMenu(page)
  await expect(menu.getByRole('menuitem', { name: '推送到 aria2（默认）' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '推送到 PotatoVN' })).toHaveCount(0)
  await expect(menu.getByRole('menuitem', { name: '通过浏览器下载', exact: true })).toBeVisible()
})

import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const patchedGame = 'E2E 管理用スクラッチ 5'
const hiddenGame = 'E2E 管理画面用エントリ 7'

async function openPatchPages(page: Page, search: string, game: string) {
  await page.goto(`/zh/admin/games?q=${encodeURIComponent(search)}`)
  await page.getByRole('button', { name: `${game}的操作` }).click()
  await page.getByRole('menuitem', { name: '鲲 Galgame 补丁页', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '鲲 Galgame 补丁页' })
  await expect(dialog).toContainText(game)
  return dialog
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('shows the pages the ids of a game find', async ({ page }) => {
    const dialog = await openPatchPages(page, '管理用スクラッチ 5', patchedGame)
    await expect(dialog.getByRole('button', { name: '按编号匹配' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(dialog).toContainText('v900005')
    const pages = dialog.getByRole('list', { name: '补丁页' })
    await expect(pages.getByRole('listitem')).toHaveCount(1)
    await expect(pages).toContainText(patchedGame)
    await expect(pages).toContainText('www.moyu.moe/galgame/9005')
    await expect(pages).toContainText('按 VNDB v900005 匹配')
    await expect(pages).toContainText('5 个资源')
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
  })

  test('assigns a page by hand and finds the pages by the ids again', async ({ page }) => {
    let dialog = await openPatchPages(page, 'E2E Backstage 7', hiddenGame)
    await expect(dialog).toContainText('v900007')
    await expect(dialog).toContainText('没有匹配到补丁页')

    await dialog.getByRole('button', { name: '手动指定' }).click()
    await expect(dialog).toContainText('不显示鲲 Galgame 补丁的条目')
    const address = dialog.getByRole('textbox', { name: '补丁页地址' })
    const add = dialog.getByRole('button', { name: '添加' })
    await address.fill('俺たちに翼はない')
    await add.click()
    await expect(dialog).toContainText('无法识别这个地址')
    await address.fill('https://www.moyu.moe/galgame/404')
    await add.click()
    await expect(dialog).toContainText('鲲 Galgame 补丁上没有这个页面')
    await address.fill('https://www.moyu.moe/resource/90051')
    await add.click()
    const pages = dialog.getByRole('list', { name: '补丁页' })
    await expect(pages).toContainText('www.moyu.moe/galgame/9005')
    await expect(address).toHaveValue('')
    await address.fill('9005')
    await add.click()
    await expect(dialog).toContainText('这个页面已在列表中')
    await expect(pages.getByRole('listitem')).toHaveCount(1)

    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, `已保存 ${hiddenGame} 的补丁页`)
    await expect(dialog).toBeHidden()

    dialog = await openPatchPages(page, 'E2E Backstage 7', hiddenGame)
    await expect(dialog.getByRole('button', { name: '手动指定' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(dialog.getByRole('list', { name: '补丁页' })).toContainText(patchedGame)
    await dialog.getByRole('button', { name: '按编号匹配' }).click()
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, `已保存 ${hiddenGame} 的补丁页`)
    await expect(dialog).toBeHidden()

    dialog = await openPatchPages(page, 'E2E Backstage 7', hiddenGame)
    await expect(dialog.getByRole('button', { name: '按编号匹配' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(dialog).toContainText('没有匹配到补丁页')
  })
})

test('keeps the patch pages from members', async ({ browser }) => {
  const context = await browser.newContext({ storageState: sessionFile('member') })
  const response = await context.request.get('/resources/admin/patch-pages?id=5')
  expect(response.status()).toBe(403)
  await context.close()
})

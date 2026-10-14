import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const name = 'E2E 友情链接'

function links(page: Page) {
  return page.getByRole('table', { name: '友情链接' })
}

function row(page: Page) {
  return links(page).getByRole('row', { name: new RegExp(name) })
}

async function choose(page: Page, action: string) {
  await page.getByRole('button', { name: `「${name}」的操作` }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('adds a link that is checked before it is sent', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '友情链接' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/friend-links$/)
    await expect(links(page)).toContainText('KUN Visual Novel Forum')
    await page.getByRole('button', { name: '添加友情链接' }).click()
    const dialog = page.getByRole('dialog', { name: '添加友情链接' })
    await dialog.getByLabel('名称').fill(name)
    await dialog.getByLabel('网址').fill('ftp://e2e.example')
    await dialog.getByRole('button', { name: '添加', exact: true }).click()
    await expect(dialog.getByText('格式不正确')).toBeVisible()
    await dialog.getByLabel('网址').fill('https://e2e.example/')
    await dialog.getByLabel('简介').fill('Seeded by a test.')
    await dialog.getByRole('button', { name: '添加', exact: true }).click()
    await expectNotice(page, '友情链接已添加')
    await expect(dialog).toBeHidden()
    await expect(row(page)).toContainText('e2e.example')
    await expect(row(page)).toContainText('显示')
  })

  test('edits, hides and shows a link', async ({ page }) => {
    await page.goto('/zh/admin/friend-links')
    await choose(page, '编辑')
    const dialog = page.getByRole('dialog', { name: '编辑友情链接' })
    await expect(dialog.getByLabel('网址')).toHaveValue('https://e2e.example/')
    await dialog.getByLabel('简介').fill('Edited by a test.')
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '友情链接已保存')
    await expect(dialog).toBeHidden()
    await expect(row(page)).toContainText('Edited by a test.')

    await choose(page, '隐藏')
    await expectNotice(page, '友情链接已隐藏')
    await expect(row(page)).toContainText('隐藏')
    await page.goto('/zh/friend-link')
    await expect(page.getByText('KUN Visual Novel Forum')).toBeVisible()
    await expect(page.getByText(name)).toHaveCount(0)

    await page.goto('/zh/admin/friend-links')
    await choose(page, '显示')
    await expectNotice(page, '友情链接已显示')
    await page.goto('/zh/friend-link')
    await expect(page.getByText(name)).toBeVisible()
  })

  test('moves a link up with the keyboard and keeps the order', async ({ page }) => {
    await page.goto('/zh/admin/friend-links')
    const saved = page.waitForResponse(response =>
      response.url().includes('/resources/admin/friend-links'),
    )
    await page.getByRole('button', { name: `移动行: ${name}` }).focus()
    await page.keyboard.press('ArrowUp')
    await saved
    await page.reload()
    const rows = links(page).getByRole('row')
    const count = await rows.count()
    await expect(rows.nth(count - 2)).toContainText(name)
  })

  test('removes a link after asking', async ({ page }) => {
    await page.goto('/zh/admin/friend-links')
    await choose(page, '删除')
    const ask = page.getByRole('alertdialog', { name: `确定要删除友情链接「${name}」吗？` })
    await ask.getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '友情链接已删除')
    await expect(row(page)).toHaveCount(0)
  })
})

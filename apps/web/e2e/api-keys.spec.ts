import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const name = 'E2E 脚本'

function keys(page: Page) {
  return page.getByRole('list', { name: 'API 密钥' })
}

async function createKey(page: Page): Promise<string> {
  await page.goto('/zh/user/settings/api-keys')
  await page.getByRole('button', { name: '创建 API 密钥' }).click()
  const dialog = page.getByRole('dialog', { name: '创建 API 密钥' })
  await dialog.getByLabel('名称').fill(name)
  await dialog.getByRole('button', { name: '创建', exact: true }).click()
  const created = page.getByRole('dialog', { name: 'API 密钥已创建' })
  await expect(created.getByText('关闭后无法再次查看完整的密钥')).toBeVisible()
  const secret = await created.locator('input[readonly]').inputValue()
  await page.keyboard.press('Escape')
  await expect(created).toBeVisible()
  await created.getByRole('button', { name: '完成' }).click()
  await expect(created).toBeHidden()
  return secret
}

async function removeKey(page: Page) {
  await page.goto('/zh/user/settings/api-keys')
  await page.getByRole('button', { name: `删除「${name}」` }).click()
  await page
    .getByRole('alertdialog', { name: `确定要删除 API 密钥「${name}」吗？` })
    .getByRole('button', { name: '删除' })
    .click()
  await expectNotice(page, 'API 密钥已删除')
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('creates a key that is shown once and lists it by its prefix', async ({ page }) => {
    const secret = await createKey(page)
    expect(secret).toMatch(/^shl_[0-9A-Za-z]{43}$/)
    const row = keys(page).getByRole('listitem').filter({ hasText: name })
    await expect(row).toContainText(secret.slice(0, 12))
    await expect(row).toContainText('尚未使用')
    await expect(page.getByText(secret)).toHaveCount(0)
  })

  test('suspends the key, which its owner sees, and restores it with a limit of its own', async ({
    page,
  }) => {
    await page.goto('/zh/admin/open-api')
    await page.getByRole('table', { name: '开放接口' }).getByText(name).click()
    const pane = page.getByRole('dialog', { name })
    await pane.getByRole('button', { name: '修改' }).click()
    const limit = page.getByRole('dialog', { name: '修改请求上限' })
    await limit.getByRole('radio', { name: '单独设置' }).click()
    await limit.getByLabel('每窗口次数').fill('300')
    await limit.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '请求上限已保存')
    await expect(pane).toContainText('每窗口 300 次')
    await pane.getByRole('button', { name: '停用' }).click()
    const suspend = page.getByRole('dialog', { name: `停用 API 密钥「${name}」` })
    await suspend.getByLabel('原因').fill('Suspended by a test.')
    await suspend.getByRole('button', { name: '停用' }).click()
    await expectNotice(page, 'API 密钥已停用')
    await expect(pane).toContainText('已停用')

    await page.goto('/zh/user/settings/api-keys')
    const row = keys(page).getByRole('listitem').filter({ hasText: name })
    await expect(row).toContainText('已停用')
    await expect(row).toContainText('Suspended by a test.')

    await page.goto('/zh/admin/open-api?status=suspended')
    await page.getByRole('button', { name: `「${name}」的操作` }).click()
    await page.getByRole('menuitem', { name: '恢复' }).click()
    await expectNotice(page, 'API 密钥已恢复')
    await page.goto('/zh/admin/open-api')
    await expect(
      page.getByRole('table', { name: '开放接口' }).getByRole('row', { name: new RegExp(name) }),
    ).toContainText('正常')
  })

  test('deletes the key after asking', async ({ page }) => {
    await removeKey(page)
    await expect(keys(page).getByText(name)).toHaveCount(0)
  })
})

import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const credited = '绿茶汉化组'
const kept = '黙示游戏中文化兴趣小组'
const merged = '默示游戏中文化兴趣小组'

function translators(page: Page) {
  return page.getByRole('table', { name: '汉化组' })
}

function duplicates(page: Page) {
  return page.getByRole('list', { name: '疑似重复的汉化组' }).getByRole('listitem')
}

async function showDuplicates(page: Page) {
  await page.goto('/zh/admin/translators')
  await page.getByLabel('范围').getByText('疑似重复').click()
  await expect(page).toHaveURL(/\/zh\/admin\/translators\?view=duplicates$/)
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('finds a translator by an alias and orders the list by name', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '汉化组' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/translators$/)
    await expect(page.getByRole('heading', { name: '汉化组', level: 1 })).toBeVisible()
    await expect(translators(page).getByRole('row').nth(1)).toContainText(credited)

    await page.getByRole('searchbox', { name: '搜索汉化组名称或别名' }).fill('green tea')
    await expect(page).toHaveURL(/q=green\+tea/)
    await expect(translators(page).getByRole('row')).toHaveCount(2)
    await expect(translators(page).getByRole('row').nth(1)).toContainText('Green Tea')

    await page.getByRole('searchbox', { name: '搜索汉化组名称或别名' }).fill('')
    await expect(page).not.toHaveURL(/q=/)
    await page.getByRole('combobox', { name: '排序方式' }).click()
    await page.getByRole('option', { name: '名称' }).click()
    await expect(page).toHaveURL(/sort=name/)
    await expect(translators(page).getByRole('row').nth(1)).toContainText('Can/need')
  })

  test('edits the aliases and the homepage of a translator', async ({ page }) => {
    await page.goto('/zh/admin/translators?q=Can%2Fneed')
    await page.getByRole('button', { name: 'Can/need的操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '编辑' }).click()
    const dialog = page.getByRole('dialog', { name: '编辑汉化组' })
    await expect(dialog.getByLabel('名称')).toHaveValue('Can/need')
    await dialog.getByLabel('别名').fill('CN组')
    await dialog.getByLabel('别名').press('Enter')
    await dialog.getByLabel('主页').fill('https://example.org/can-need')
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '汉化组已更新')
    await expect(dialog).toBeHidden()
    await expect(translators(page).getByRole('row', { name: /CN组/ })).toBeVisible()
  })

  test('refuses a name that another translator has', async ({ page }) => {
    await page.goto('/zh/admin/translators?q=Can%2Fneed')
    await page.getByRole('button', { name: 'Can/need的操作', exact: true }).click()
    await page.getByRole('menuitem', { name: '编辑' }).click()
    const dialog = page.getByRole('dialog', { name: '编辑汉化组' })
    await dialog.getByLabel('名称').fill(credited)
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '这个名称已被其他汉化组使用')
    await expect(dialog).toBeVisible()
  })

  test('records that two similar names are different translators', async ({ page }) => {
    await showDuplicates(page)
    await expect(duplicates(page)).toHaveCount(2)
    const pair = duplicates(page).filter({ hasText: 'Can/need汉化组' })
    await pair.getByRole('button', { name: '并非重复' }).click()
    await expectNotice(page, '已记为不同的汉化组')
    await expect(duplicates(page)).toHaveCount(1)
  })

  test('merges the translators that are the same under the name that is kept', async ({ page }) => {
    await showDuplicates(page)
    await duplicates(page).filter({ hasText: merged }).getByRole('button', { name: '合并' }).click()
    const dialog = page.getByRole('dialog', { name: '合并汉化组' })
    await dialog.getByRole('radio', { name: new RegExp(kept) }).click()
    await dialog.getByRole('button', { name: '合并' }).click()
    await expectNotice(page, `已合并到 ${kept}`)
    await expect(dialog).toBeHidden()
    await expect(page.getByText('没有疑似重复的汉化组')).toBeVisible()

    await page.goto('/zh/admin/translators?q=%E9%BB%98%E7%A4%BA')
    await expect(translators(page).getByRole('row')).toHaveCount(2)
    await expect(translators(page).getByRole('row').nth(1)).toContainText(kept)
    await expect(translators(page).getByRole('row').nth(1)).toContainText(merged)
  })
})

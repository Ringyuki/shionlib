import { expect, test, type Page } from '@playwright/test'

const listed = '/zh/game/5'
const unlisted = '/zh/game/1'
const manual = '【绿茶汉化组】E2E 人工汉化补丁 v1.2'

const cards = (page: Page) => page.getByRole('main').getByRole('article')

const chip = (page: Page, group: string, name: string) =>
  page.getByRole('group', { name: group }).getByRole('button', { name, exact: true })

async function sortBy(page: Page, order: string) {
  await page.getByRole('combobox', { name: '排序方式' }).click()
  await page.getByRole('option', { name: order }).click()
}

test('lists what 鲲 Galgame 补丁 holds for a game with the page itself', async ({ page }) => {
  const first = await page.request.get(listed)
  expect(await first.text()).toContain('E2E AI 翻译补丁')
  await page.goto(listed)
  await expect(cards(page)).toHaveCount(5)
  await expect(cards(page).nth(0)).toContainText('E2E 移植版')
  await expect(cards(page).nth(3)).toContainText('E2E 修正补丁')
  await expect(cards(page).nth(4)).toContainText('全CG存档')

  const patch = cards(page).filter({ hasText: manual })
  for (const text of [
    '补丁',
    'Windows',
    '简中',
    '繁中',
    'patch-archive',
    '561 次下载',
    '850.34 MB',
  ]) {
    await expect(patch).toContainText(text)
  }
  const page_ = patch.getByRole('link', { name: `在鲲 Galgame 补丁查看 ${manual}` })
  await expect(page_).toHaveAttribute('href', 'https://www.moyu.moe/resource/90051')
  await expect(page_).toHaveAttribute('target', '_blank')

  const machine = cards(page).filter({ hasText: 'E2E AI 翻译补丁' })
  await expect(machine).toContainText('机器翻译')
  await expect(machine).toContainText('gemini-2.5-pro')
  await expect(
    cards(page).nth(4).getByRole('link', { name: '在鲲 Galgame 补丁查看 全CG存档' }),
  ).toHaveAttribute('href', 'https://www.moyu.moe/resource/90053')
  await expect(page.getByRole('link', { name: '鲲 Galgame 补丁', exact: true })).toHaveAttribute(
    'href',
    'https://www.moyu.moe',
  )
})

test('narrows and orders the list without leaving the page', async ({ page }) => {
  await page.goto(listed)
  await chip(page, '类型', '补丁').click()
  await chip(page, '翻译', '汉化组').click()
  await expect(cards(page)).toHaveCount(2)
  await chip(page, '平台', 'Android').click()
  await expect(cards(page)).toHaveCount(1)
  await expect(cards(page)).toContainText('E2E 移植版')
  await chip(page, '语言', '繁中').click()
  await expect(cards(page)).toHaveCount(0)
  await expect(page.getByText('没有符合条件的资源')).toBeVisible()
  await page.getByRole('button', { name: '重置筛选' }).click()
  await expect(cards(page)).toHaveCount(5)
  await expect(chip(page, '类型', '补丁')).toHaveAttribute('aria-pressed', 'false')

  await sortBy(page, '下载次数最多')
  await expect(cards(page).nth(0)).toContainText('E2E AI 翻译补丁')
  await expect(cards(page).nth(4)).toContainText('全CG存档')
  await sortBy(page, '文件最小')
  await expect(cards(page).nth(0)).toContainText('E2E 修正补丁')
  await expect(cards(page).nth(3)).toContainText('E2E 移植版')
  await sortBy(page, '文件最大')
  await expect(cards(page).nth(0)).toContainText('E2E 移植版')
  await expect(page).toHaveURL(new RegExp(`${listed}$`))
})

test('shows only its own resources for a game the other site does not list', async ({ page }) => {
  await page.goto(unlisted)
  await expect(page.locator('#resource-1')).toBeVisible()
  await expect(page.getByText('补丁和全CG存档来自')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: '排序方式' })).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the choices in a sheet', async ({ page }) => {
    await page.goto(listed)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '筛选' }).click()
    const sheet = page.getByRole('dialog', { name: '筛选' })
    await sheet
      .getByRole('group', { name: '类型' })
      .getByRole('button', { name: '全CG存档' })
      .click()
    await sheet.getByRole('button', { name: '查看 1 项' }).click()
    await expect(sheet).toBeHidden()
    await expect(cards(page)).toHaveCount(1)
    await page.getByRole('button', { name: '筛选' }).click()
    await sheet.getByRole('button', { name: '重置' }).click()
    await sheet.getByRole('button', { name: '查看 5 项' }).click()
    await expect(cards(page)).toHaveCount(5)
  })
})

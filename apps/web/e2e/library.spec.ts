import { expect, test, type Page } from '@playwright/test'

const temporaryGame = /^E2E 管理临时作品/

function filters(page: Page) {
  return page.getByRole('complementary', { name: '筛选' })
}

function games(page: Page) {
  return page.getByRole('list', { name: '游戏列表' }).getByRole('listitem')
}

test('narrows the library by tag and platform and keeps the conditions in the address', async ({
  page,
}) => {
  await page.goto('/zh/game')
  await filters(page).getByRole('switch', { name: '仅显示有资源的游戏' }).click()
  await expect(page).toHaveURL(/\/zh\/game\?resources=any$/)

  const tags = filters(page).getByRole('combobox', { name: '标签', exact: true })
  await tags.fill('e2e')
  await page.getByRole('option', { name: /^e2e/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\?tag=e2e&resources=any$/)
  await expect(games(page)).toHaveCount(3)
  await expect(games(page).filter({ hasText: temporaryGame })).toHaveCount(3)
  await expect(page.getByText('共 3 部游戏')).toBeVisible()
  await page.keyboard.press('Escape')

  await filters(page).getByRole('button', { name: 'Windows' }).click()
  await expect(page).toHaveURL(/\/zh\/game\?tag=e2e&platform=win&resources=any$/)
  await expect(page.getByText('没有符合条件的游戏')).toBeVisible()

  await page.reload()
  await expect(filters(page).getByRole('button', { name: 'Windows' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '重置筛选' }).click()
  await expect(page).toHaveURL(/\/zh\/game$/)
  await expect(filters(page).getByRole('button', { name: '重置' })).toBeDisabled()
})

test('orders the library and offers months once a year is chosen', async ({ page }) => {
  await page.goto('/zh/game?resources=any')
  await page.getByRole('combobox', { name: '排序方式' }).click()
  await page.getByRole('option', { name: '最早发售' }).click()
  await expect(page).toHaveURL(/\/zh\/game\?order=asc&resources=any$/)
  await expect(games(page).first()).toContainText('仰望夜空的星辰')

  const months = filters(page).getByRole('combobox', { name: '发售月份' })
  await expect(months).toBeDisabled()
  await filters(page).getByRole('combobox', { name: '发售年份' }).click()
  await page.getByRole('option', { name: '2020' }).click()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/zh\/game\?year=2020&order=asc&resources=any$/)
  await expect(games(page).filter({ hasText: temporaryGame })).toHaveCount(3)
  await expect(months).toBeEnabled()

  await page.getByRole('combobox', { name: '排序方式' }).click()
  await page.getByRole('option', { name: '最近更新资源' }).click()
  await expect(page).toHaveURL(/sort=resource_updated/)
  const onlyWithResources = filters(page).getByRole('switch', { name: '仅显示有资源的游戏' })
  await expect(onlyWithResources).toBeChecked()
  await expect(onlyWithResources).toBeDisabled()
})

test('leads from a tag on a game page to the games that carry it', async ({ page }) => {
  await page.goto('/zh/game/1/info')
  await page.getByRole('link', { name: 'galgame', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/game\?tag=galgame$/)
  await expect(page.getByRole('heading', { name: '游戏库', level: 1 })).toBeVisible()
  await expect(games(page).filter({ hasText: '常轨脱离Creative Re:Re:call' })).toHaveCount(1)
})

test('sends the old address of the library to the current one', async ({ page }) => {
  await page.goto(
    '/zh/game?filter[tags][]=e2e&filter[years][]=2020&filter[platforms][]=win&filter[sort_by]=views&filter[sort_order]=desc',
  )
  await expect(page).toHaveURL(/\/zh\/game\?tag=e2e&platform=win&year=2020&sort=views$/)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the filters in a sheet and shows what is applied above the games', async ({
    page,
  }) => {
    await page.goto('/zh/game?tag=e2e&resources=any')
    const applied = page.getByRole('group', { name: '已选条件' })
    await expect(applied).toContainText('e2e')
    await expect(applied).toContainText('包含没有资源的游戏')

    await page.getByRole('button', { name: '筛选' }).click()
    const sheet = page.getByRole('dialog', { name: '筛选' })
    await sheet.getByRole('button', { name: 'Windows' }).click()
    await expect(page).toHaveURL(/platform=win/)
    await expect(sheet.getByRole('button', { name: '查看 0 部游戏' })).toBeVisible()
    await sheet.getByRole('button', { name: '查看 0 部游戏' }).click()
    await expect(sheet).toBeHidden()

    await applied.getByRole('button', { name: '移除' }).nth(1).click()
    await expect(page).toHaveURL(/\/zh\/game\?tag=e2e&resources=any$/)
    await expect(games(page)).toHaveCount(3)
  })
})

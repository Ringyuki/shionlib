import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const shownGame = 'ハミダシクリエイティブ Re:Re:call'
const hiddenGame = 'E2E 管理画面用エントリ 7'
const removedGame = 'E2E 管理画面用エントリ 8'
const unreachable = '数据源暂时无法访问'

function games(page: Page) {
  return page.getByRole('table', { name: '游戏' })
}

async function choose(page: Page, game: string, action: string) {
  await page.getByRole('button', { name: `${game}的操作` }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('finds a game by its status, its name and its number', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '游戏' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/games$/)
    await expect(page.getByRole('heading', { name: '游戏', level: 1 })).toBeVisible()
    await expect(games(page).getByRole('row', { name: new RegExp(shownGame) })).toContainText(
      '显示',
    )
    await expect(games(page).getByRole('row').nth(1)).toContainText(shownGame)

    await page.getByRole('button', { name: '隐藏', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/games\?status=2$/)
    await expect(games(page).getByRole('row')).toHaveCount(3)
    await expect(games(page).getByRole('row', { name: new RegExp(removedGame) })).toContainText(
      '成人',
    )

    await page.getByRole('searchbox', { name: '搜索游戏名称或编号' }).fill('7')
    await expect(page).toHaveURL(/\/zh\/admin\/games\?q=7&status=2$/)
    await expect(games(page).getByRole('row')).toHaveCount(2)
    await expect(games(page).getByRole('row', { name: new RegExp(hiddenGame) })).toBeVisible()

    await page.getByRole('searchbox', { name: '搜索游戏名称或编号' }).fill('Re:Re:call')
    await expect(page.getByText('没有符合条件的游戏')).toBeVisible()
    await page.getByRole('button', { name: '全部', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/games\?q=Re%3ARe%3Acall$/)
    await expect(games(page).getByRole('row')).toHaveCount(2)
  })

  test('shows a hidden game, lists it among the recent updates and hides it again', async ({
    page,
  }) => {
    await page.goto('/zh/admin/games?q=E2E+Backstage+7')
    const row = games(page).getByRole('row', { name: new RegExp(hiddenGame) })
    await expect(row).toContainText('隐藏')

    await choose(page, hiddenGame, '显示')
    await expectNotice(page, `已显示 ${hiddenGame}`)
    await expect(row).toContainText('显示')

    await choose(page, hiddenGame, '列入最近更新')
    await expectNotice(page, `已将 ${hiddenGame} 列入最近更新`)
    await choose(page, hiddenGame, '移出最近更新')
    await expectNotice(page, `已将 ${hiddenGame} 移出最近更新`)

    await choose(page, hiddenGame, '隐藏')
    await expectNotice(page, `已隐藏 ${hiddenGame}`)
    await expect(row).toContainText('隐藏')
  })

  test('tells where each source stands and what is kept out', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '条目同步' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/catalog$/)
    await expect(page.getByRole('heading', { name: '条目同步', level: 1 })).toBeVisible()
    await expect(page.getByText('超过 7 天没有同步的条目会重新获取')).toBeVisible()
    const source = page
      .getByRole('table', { name: '来源' })
      .getByRole('row', { name: /Hikarinagi/ })
    await expect(source).toContainText('8 个游戏')
    await expect(source).toContainText('135875')
    await expect(source).toContainText('更新了 14 个条目')

    const excluded = page.getByRole('table', { name: '不再收录的条目' })
    const seeded = excluded.getByRole('row', { name: /テスト用エントリ/ })
    await expect(seeded).toContainText('21004')
    await expect(seeded).toContainText('e2e_admin')
    await expect(seeded).toContainText('上周')

    await expect(page.getByText('尚未设置应用的 ID 和密钥')).toBeVisible()
    await expect(page.getByText(/\/api\/admin\/bangumi\/authorization\/callback$/)).toBeVisible()
    await expect(page.getByRole('link', { name: '前往授权' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  test('removes a game and keeps its entry out until the source answers', async ({ page }) => {
    await page.goto('/zh/admin/games?q=E2E+Backstage+8')
    await choose(page, removedGame, '删除并不再收录')
    const confirm = page.getByRole('alertdialog', { name: `确定要删除 ${removedGame} 吗？` })
    await expect(confirm).toContainText('之后同步时会跳过这个条目')
    await confirm.getByRole('button', { name: '删除', exact: true }).click()
    await expectNotice(page, `已删除 ${removedGame}`)
    await expect(page.getByText('没有符合条件的游戏')).toBeVisible()

    await page.goto('/zh/admin/catalog')
    const entry = page
      .getByRole('table', { name: '不再收录的条目' })
      .getByRole('row', { name: new RegExp(removedGame) })
    await expect(entry).toContainText('e2e_admin')
    await expect(entry).toContainText('刚刚')
    await entry.getByRole('button', { name: '恢复收录' }).click()
    await expectNotice(page, unreachable)
    await expect(entry).toBeVisible()
  })

  test('reports a source that cannot be reached', async ({ page }) => {
    await page.goto('/zh/admin/catalog')
    await page.getByRole('searchbox', { name: '名称或来源编号' }).fill('サクラノ')
    await expectNotice(page, unreachable)
    await expect(page.getByText('未能取得查找结果')).toBeVisible()

    const source = page
      .getByRole('table', { name: '来源' })
      .getByRole('row', { name: /Hikarinagi/ })
    await source.getByRole('button', { name: '立即同步' }).click()
    await expectNotice(page, unreachable)
    await expect(source).toContainText('同步失败')
  })
})

test('keeps the games and the catalog from members', async ({ browser }) => {
  const context = await browser.newContext({ storageState: sessionFile('member') })
  const page = await context.newPage()
  for (const path of ['/zh/admin/games', '/zh/admin/catalog']) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(403)
  }
  await context.close()
})

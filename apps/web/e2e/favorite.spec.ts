import { expect, test } from '@playwright/test'
import { sessionFile, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

test('asks a guest to sign in, then opens the lists', async ({ page }) => {
  await page.goto('/zh/game/4')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await signIn(page, 'e2e_list_all_user')
  await expect(page.getByText('收藏到')).toBeVisible()
})

test('asks a guest to sign in before showing their favorites', async ({ page }) => {
  await page.goto('/zh/user/favorites')
  await expect(page.getByRole('heading', { name: '我的收藏', level: 1 })).toBeVisible()
  await expect(page.getByText('登录后可以查看和管理收藏')).toBeVisible()
  await expect(page.getByRole('button', { name: '新建收藏夹' })).toHaveCount(0)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('keeps the lists on a page of their own: a private list, a note, taking a game out and back', async ({
    page,
  }) => {
    const name = `E2E 想玩 ${Date.now()}`
    await page.goto('/zh')
    await page.getByRole('link', { name: '收藏', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/user\/favorites$/)

    await page.getByRole('button', { name: '新建收藏夹' }).click()
    const creation = page.getByRole('dialog', { name: '新建收藏夹' })
    await creation.getByLabel('名称').fill(name)
    await creation.getByRole('checkbox', { name: '仅自己可见' }).click()
    await creation.getByRole('button', { name: '创建', exact: true }).click()
    await expectNotice(page, `已新建「${name}」`)
    await expect(page).toHaveURL(/\/zh\/user\/favorites\/\d+$/)
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
    await expect(page.getByText('这个收藏夹中暂无游戏')).toBeVisible()
    const listUrl = page.url()
    const listId = listUrl.slice(listUrl.lastIndexOf('/') + 1)

    await page.goto('/zh/user/2/favorites')
    await expect(
      page
        .getByRole('navigation', { name: '收藏夹' })
        .getByRole('link', { name: new RegExp(name) }),
    ).toHaveCount(0)
    await page.goto(`/zh/user/2/favorites/${listId}`)
    await expect(page.getByText('页面不存在')).toBeVisible()

    await page.goto('/zh/game/6')
    await page.getByRole('button', { name: /^(收藏|已收藏)$/ }).click()
    await page.getByRole('checkbox', { name: new RegExp(name) }).click()
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()

    await page.goto(listUrl)
    const games = page.getByRole('list', { name: '收藏的游戏' })
    const game = games.getByRole('link').filter({ hasText: 'E2E 管理临时作品 6' })
    await expect(game).toHaveAttribute('href', '/zh/game/6')
    const actions = games.getByRole('button', { name: 'E2E 管理临时作品 6 的操作' })
    await actions.click()
    await page.getByRole('menuitem', { name: '编辑备注' }).click()
    const note = page.getByRole('dialog', { name: '编辑备注' })
    await note.getByLabel('备注').fill('等汉化补丁')
    await note.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '备注已保存')
    await expect(game).toContainText('等汉化补丁')

    await actions.click()
    await page.getByRole('menuitem', { name: '移出收藏夹' }).click()
    await expect(page.getByText('这个收藏夹中暂无游戏')).toBeVisible()
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(game).toContainText('等汉化补丁')

    await page.getByRole('button', { name: '收藏夹操作' }).click()
    await page.getByRole('menuitem', { name: '编辑收藏夹' }).click()
    const edit = page.getByRole('dialog', { name: '编辑收藏夹' })
    await expect(edit.getByRole('checkbox', { name: '仅自己可见' })).toBeChecked()
    await edit.getByLabel('简介').fill('通关后再整理')
    await edit.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '收藏夹已更新')
    await expect(page.getByText('通关后再整理')).toBeVisible()

    await page.getByRole('button', { name: '收藏夹操作' }).click()
    await page.getByRole('menuitem', { name: '删除收藏夹' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '删除收藏夹' }).click()
    await expectNotice(page, '收藏夹已删除')
    await expect(page).toHaveURL(/\/zh\/user\/favorites$/)
    await expect(page.getByRole('navigation', { name: '收藏夹' }).getByText(name)).toHaveCount(0)
  })

  test('adds the game to a list and takes it out again', async ({ page }) => {
    await page.goto('/zh/game/2')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    const list = page.getByRole('checkbox').first()
    await list.click()
    await expect(list).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible()
    await page.getByRole('button', { name: '已收藏' }).click()
    await list.click()
    await expect(list).not.toBeChecked()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
  })

  test('keeps the page when the reload after a change gets no answer', async ({ page }) => {
    await page.goto('/zh/game/3')
    await page.waitForLoadState('networkidle')
    const title = await page.getByRole('heading', { level: 1 }).innerText()
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    const list = page.getByRole('checkbox').first()
    await expect(list).toBeVisible()
    await page.route(
      url => url.pathname.endsWith('.data'),
      route => (route.request().method() === 'GET' ? route.abort() : route.fallback()),
    )
    await list.click()
    await expectNotice(page, '请求未成功，请稍后再试')
    await expect(list).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page.getByRole('link', { name: '我的上传' })).toBeVisible()
  })

  test('creates a list and saves the game into it', async ({ page }) => {
    const name = `E2E ${Date.now()}`
    await page.goto('/zh/game/5')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    await page.getByRole('button', { name: '新建收藏夹' }).click()
    const dialog = page.getByRole('dialog', { name: '新建收藏夹' })
    await dialog.getByLabel('名称').fill(name)
    await dialog.getByRole('button', { name: '创建并收藏' }).click()
    await expectNotice(page, `已新建「${name}」并收藏`)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible()
  })
})

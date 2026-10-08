import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

test('shows what a user uploaded and leads to the resource', async ({ page }) => {
  await page.goto('/zh/user/3')
  await expect(page.getByRole('heading', { name: 'e2e_mutable_user', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: '编辑资料' })).toHaveCount(0)
  const uploads = page.getByRole('list', { name: '上传的资源' })
  await expect(
    uploads.getByRole('link').filter({ hasText: 'seeded-reportable-sample.zip' }),
  ).toHaveAttribute('href', '/zh/game/1#resource-1')

  await page.getByRole('tab', { name: '收藏夹' }).click()
  await expect(page).toHaveURL(/\/zh\/user\/3\/favorites$/)
  await expect(page.getByRole('button', { name: '新建收藏夹' })).toHaveCount(0)
})

test('sends the old address of the uploads tab to the profile', async ({ page }) => {
  await page.goto('/zh/user/3/uploads')
  await expect(page).toHaveURL(/\/zh\/user\/3$/)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('keeps a list of favorites: creates it, notes a game, takes it out and puts it back', async ({
    page,
  }) => {
    const name = `E2E 想玩 ${Date.now()}`
    await page.goto('/zh')
    await page.getByRole('link', { name: '收藏', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/user\/\d+\/favorites$/)
    await expect(page.getByRole('link', { name: '编辑资料' })).toBeVisible()

    await page.getByRole('button', { name: '新建收藏夹' }).click()
    const creation = page.getByRole('dialog', { name: '新建收藏夹' })
    await creation.getByLabel('名称').fill(name)
    await creation.getByRole('checkbox', { name: '仅自己可见' }).click()
    await creation.getByRole('button', { name: '创建', exact: true }).click()
    await expectNotice(page, `已新建「${name}」`)
    await expect(page).toHaveURL(/\/favorites\/\d+$/)
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible()
    await expect(page.getByText('这个收藏夹中暂无游戏。')).toBeVisible()
    const listUrl = page.url()

    await page.goto('/zh/game/6')
    await page.getByRole('button', { name: /^(收藏|已收藏)$/ }).click()
    await page.getByRole('checkbox', { name: new RegExp(name) }).click()
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()

    await page.goto(listUrl)
    const games = page.getByRole('list', { name: '收藏的游戏' })
    await expect(games.getByRole('link', { name: 'E2E 管理临时作品 6' })).toHaveAttribute(
      'href',
      '/zh/game/6',
    )
    await games.getByRole('button', { name: '收藏操作' }).click()
    await page.getByRole('menuitem', { name: '编辑备注' }).click()
    const note = page.getByRole('dialog', { name: '编辑备注' })
    await note.getByLabel('备注').fill('等汉化补丁')
    await note.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '备注已保存')
    await expect(games.getByText('等汉化补丁')).toBeVisible()

    await games.getByRole('button', { name: '收藏操作' }).click()
    await page.getByRole('menuitem', { name: '移出收藏夹' }).click()
    await expect(page.getByText('这个收藏夹中暂无游戏。')).toBeVisible()
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(games.getByText('等汉化补丁')).toBeVisible()

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
    await expect(page).toHaveURL(/\/zh\/user\/\d+\/favorites$/)
    await expect(page.getByRole('navigation', { name: '收藏夹' }).getByText(name)).toHaveCount(0)
  })
})

import { expect, test, type Page } from '@playwright/test'
import { openSignIn, sessionFile, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

const onePixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const picture = {
  name: 'picture.png',
  mimeType: 'image/png',
  buffer: Buffer.from(onePixel, 'base64'),
}

async function countBackgrounds(page: Page) {
  const asked = { count: 0 }
  await page.route('**/user/e2e/background/**', route => {
    asked.count += 1
    return route.fulfill({ status: 200, contentType: picture.mimeType, body: picture.buffer })
  })
  return asked
}

test('shows what a user uploaded, each entry one link to the resource', async ({ page }) => {
  await page.goto('/zh/user/3')
  await expect(page.getByRole('heading', { name: 'e2e_mutable_user', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑资料' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '管理我的上传' })).toHaveCount(0)
  const uploads = page.getByRole('list', { name: '上传的资源' })
  const entry = uploads.getByRole('link').filter({ hasText: 'seeded-reportable-sample.zip' })
  await expect(entry).toHaveAttribute('href', '/zh/game/1#resource-1')
  await expect(uploads.getByRole('listitem').first().getByRole('link')).toHaveCount(1)
  const [row, list] = [await entry.boundingBox(), await uploads.boundingBox()]
  expect(row?.width).toBe(list?.width)
  expect(row?.height).toBeGreaterThanOrEqual(104)
})

test('shows a visitor only the kinds of content a user has and opens the first', async ({
  page,
}) => {
  await page.goto('/zh/user/3')
  await expect(page.getByRole('tab', { name: /上传/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: /攻略/ })).toHaveCount(0)

  await page.goto('/zh/user/2')
  await expect(page).toHaveURL(/\/zh\/user\/2\/(favorites|comments|walkthroughs)/)
  await expect(page.getByRole('tab', { name: /上传/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '新建收藏夹' })).toHaveCount(0)

  await page.goto('/zh/user/4')
  await expect(page.getByRole('heading', { name: 'e2e_permission_user', level: 1 })).toBeVisible()
  await expect(page.getByText('暂无公开内容')).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
})

test('puts the page background of a user behind a translucent sheet, never on a phone', async ({
  page,
}) => {
  const asked = await countBackgrounds(page)
  await page.goto('/zh/user/3')
  const sheet = page.getByRole('article', { name: 'e2e_mutable_user' })
  await expect(sheet).toHaveCSS('backdrop-filter', 'blur(24px)')
  await expect.poll(() => asked.count).toBe(1)

  await page.setViewportSize({ width: 390, height: 844 })
  asked.count = 0
  await page.reload()
  await expect(sheet).toHaveCSS('backdrop-filter', 'none')
  await page.mouse.wheel(0, 600)
  expect(asked.count).toBe(0)
})

test('sends the old address of the uploads tab to the profile', async ({ page }) => {
  await page.goto('/zh/user/3/uploads')
  await expect(page).toHaveURL(/\/zh\/user\/3$/)
})

test('edits the profile in one dialog: pictures are cropped first and all is saved at once', async ({
  page,
}) => {
  let saved = 0
  await page.route('**/resources/profile/edit.data', route => {
    saved += 1
    return route.fulfill({
      status: 200,
      contentType: 'text/x-script',
      body: '[{"_1":2},"data",{"_3":4,"_5":6},"ok",true,"result",null]',
    })
  })
  await openSignIn(page, '/zh/user/6')
  await signIn(page, 'e2e_admin_ops_user')
  await page.getByRole('button', { name: '编辑资料' }).click()
  const dialog = page.getByRole('dialog', { name: '编辑资料' })
  const save = dialog.getByRole('button', { name: '保存' })
  await expect(save).toBeDisabled()

  const chooser = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: '上传头像' }).click()
  await (await chooser).setFiles(picture)
  const crop = page.getByRole('dialog', { name: '裁剪头像' })
  await expect(crop.locator('.advanced-cropper-circle-stencil')).toBeVisible()
  await crop.getByRole('button', { name: '确认' }).click()
  await expect(crop).toBeHidden()
  await expect(dialog.getByRole('button', { name: '更换头像' })).toBeVisible()
  await expect(save).toBeEnabled()
  expect(saved).toBe(0)

  await page.keyboard.press('Escape')
  const discard = page.getByRole('alertdialog', { name: '确定要放弃尚未保存的修改吗？' })
  await discard.getByRole('button', { name: '继续编辑' }).click()
  await expect(dialog).toBeVisible()

  await save.click()
  await expectNotice(page, '资料已保存')
  await expect(dialog).toBeHidden()
  expect(saved).toBe(1)

  await page.getByRole('button', { name: '编辑资料' }).click()
  await dialog.getByRole('textbox', { name: '简介' }).fill('不保存')
  await dialog.getByRole('button', { name: '取消' }).click()
  await discard.getByRole('button', { name: '放弃修改' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('不保存')).toHaveCount(0)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('saves the bio from the profile', async ({ page }) => {
    await page.goto('/zh')
    await page.getByRole('link', { name: '收藏', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/user\/\d+\/favorites$/)
    for (const tab of ['上传', '收藏夹', '评论', '攻略']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible()
    }
    const bio = `E2E 简介 ${Date.now()}`
    await page.getByRole('button', { name: '编辑资料' }).click()
    const dialog = page.getByRole('dialog', { name: '编辑资料' })
    await dialog.getByRole('textbox', { name: '简介' }).fill(bio)
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '资料已保存')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('article', { name: 'e2e_user' }).getByText(bio)).toBeVisible()
    await page.getByRole('tab', { name: /上传/ }).click()
    await expect(page.getByRole('link', { name: '管理我的上传' })).toHaveAttribute(
      'href',
      '/zh/user/uploads',
    )
  })

  test('keeps a list of favorites: creates it, takes a game out and puts it back', async ({
    page,
  }) => {
    const name = `E2E 想玩 ${Date.now()}`
    await page.goto('/zh')
    await page.getByRole('link', { name: '收藏', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/user\/\d+\/favorites$/)
    const lists = page.getByRole('navigation', { name: '收藏夹' })

    await page.getByRole('button', { name: '新建收藏夹' }).click()
    const creation = page.getByRole('dialog', { name: '新建收藏夹' })
    await creation.getByLabel('名称').fill(name)
    await creation.getByRole('checkbox', { name: '仅自己可见' }).click()
    await creation.getByRole('button', { name: '创建', exact: true }).click()
    await expectNotice(page, `已新建「${name}」`)
    await expect(page).toHaveURL(/\/favorites\/\d+$/)
    await expect(lists.getByRole('link', { name: new RegExp(name) })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByText('这个收藏夹中暂无游戏')).toBeVisible()
    const listUrl = page.url()

    await page.goto('/zh/game/6')
    await page.getByRole('button', { name: /^(收藏|已收藏)$/ }).click()
    await page.getByRole('checkbox', { name: new RegExp(name) }).click()
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked()

    await page.goto(listUrl)
    const games = page.getByRole('list', { name: '收藏的游戏' })
    const game = games.getByRole('link', { name: 'E2E 管理临时作品 6' })
    await expect(game).toHaveAttribute('href', '/zh/game/6')
    await games.getByRole('button', { name: 'E2E 管理临时作品 6 的操作' }).click()
    await page.getByRole('menuitem', { name: '移出收藏夹' }).click()
    await expect(page.getByText('这个收藏夹中暂无游戏')).toBeVisible()
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(game).toBeVisible()

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
    await expect(lists.getByText(name)).toHaveCount(0)
  })
})

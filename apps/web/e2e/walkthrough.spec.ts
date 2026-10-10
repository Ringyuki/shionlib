import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

test('lists the walkthroughs of a game on their tab and asks a guest to sign in before writing', async ({
  page,
}) => {
  await page.goto('/zh/game/2')
  await page.getByRole('tab', { name: /攻略/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
  await expect(page.getByText('这个游戏暂无攻略')).toBeVisible()
  await page.getByRole('link', { name: '写攻略' }).click()
  await expect(page.getByRole('dialog', { name: '登录 Shionlib' })).toBeVisible()
})

test('answers 404 for a walkthrough under the address of another game', async ({ page }) => {
  const response = await page.goto('/zh/game/2/walkthrough/999999')
  expect(response?.status()).toBe(404)
})

test('keeps the old address of the writing page', async ({ page }) => {
  await page.goto('/zh/game/2/walkthrough/edit')
  await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/new$/)
  await expect(page.getByText('登录后可以撰写攻略')).toBeVisible()
})

const picture = {
  name: 'map.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
}

const uploadedPicture = {
  code: 0,
  message: '',
  data: {
    key: 'richtext/2/0b6f8a52-3c1d-4e8a-9f47-2d5a6c7b8e90.webp',
    width: 1200,
    height: 675,
  },
  requestId: 'e2e',
  timestamp: '2026-01-01T00:00:00.000Z',
}

async function remove(page: Page) {
  await page.getByRole('button', { name: '更多操作' }).click()
  await page.getByRole('menuitem', { name: '删除' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm.getByText('攻略删除后无法恢复')).toBeVisible()
  await confirm.getByRole('button', { name: '删除' }).click()
  await expectNotice(page, '攻略已删除')
}

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('writes a draft, reads it with its contents, publishes and deletes it', async ({ page }) => {
    const title = `E2E 全线攻略 ${Date.now()}`
    await page.route('**/api/uploads/small/richtext/image', route =>
      route.fulfill({ json: uploadedPicture }),
    )
    await page.route(`**/${uploadedPicture.data.key}`, route =>
      route.fulfill({ contentType: picture.mimeType, body: picture.buffer }),
    )
    await page.goto('/zh/game/2/walkthrough')
    await page.getByRole('link', { name: '写攻略' }).first().click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/new$/)
    await page.getByRole('textbox', { name: '标题' }).fill(title)
    await page.keyboard.press('Enter')
    const content = page.getByRole('textbox', { name: '正文' })
    const tools = page.getByRole('toolbar', { name: '格式' })
    await expect(content).toBeFocused()
    await page.keyboard.type('前言。')
    await page.keyboard.press('Enter')
    await tools.getByRole('button', { name: '正文' }).click()
    await page.getByRole('menuitemradio', { name: /大标题/ }).click()
    await expect(tools.getByRole('button', { name: '大标题' })).toBeVisible()
    await page.keyboard.type('共通线')
    await page.keyboard.press('Enter')
    await tools.getByRole('button', { name: '无序列表' }).click()
    await page.keyboard.type('选 A')
    await page.keyboard.press('Enter')
    await page.keyboard.type('选 B')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.type('### 分支')
    await page.keyboard.press('Enter')
    await page.keyboard.type('去海边。')
    await expect(content.getByRole('heading', { name: '分支', level: 3 })).toBeVisible()
    await page.keyboard.press('Enter')
    await page.keyboard.type('/表')
    await page
      .getByRole('listbox', { name: '插入内容' })
      .getByRole('option', { name: '表格' })
      .click()
    await page.keyboard.type('章节')
    await page.keyboard.press('Tab')
    await page.keyboard.type('选项')
    await content.getByRole('button', { name: '在下方添加一行' }).click()
    await expect(content.getByRole('row')).toHaveCount(4)
    await content.getByRole('cell').first().hover()
    await content.getByRole('button', { name: '选中这一行' }).nth(1).click({ force: true })
    await page.getByRole('menuitem', { name: '在下方插入行' }).click()
    await expect(content.getByRole('row')).toHaveCount(5)
    const chooser = page.waitForEvent('filechooser')
    await tools.getByRole('button', { name: '图片' }).click()
    await (await chooser).setFiles(picture)
    await content.locator('figure img').click()
    const caption = content.getByRole('textbox', { name: '图片说明' })
    await caption.fill('分支示意图')
    await caption.press('Enter')
    await expect(caption).toHaveValue('分支示意图')

    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '游戏库' })
      .click()
    const leave = page.getByRole('alertdialog')
    await expect(leave.getByText('尚未保存的修改将会丢失')).toBeVisible()
    await leave.getByRole('button', { name: '继续编辑' }).click()
    await expect(page).toHaveURL(/\/walkthrough\/new$/)

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+\/edit$/)
    await expect(page.getByRole('status').filter({ hasText: '草稿已保存' })).toBeVisible()
    await expect(page.getByRole('button', { name: '撤销' })).toBeEnabled()
    await page.getByRole('link', { name: '返回' }).click()

    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+$/)
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(page.getByText('这篇攻略尚未发布，仅你可见')).toBeVisible()
    await expect(page.getByRole('heading', { name: '共通线', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '分支', level: 3 })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: '选 B' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '章节' })).toBeVisible()
    await expect(page.getByRole('article').getByRole('row')).toHaveCount(5)
    await expect(page.getByRole('article').locator('figcaption')).toHaveText('分支示意图')
    const contents = page.getByRole('complementary').getByRole('navigation', { name: '目录' })
    await expect(contents.getByRole('link', { name: '共通线' })).toBeVisible()
    await expect(contents.getByRole('link', { name: '分支' })).toBeVisible()
    const reading = new URL(page.url()).pathname

    await page.getByRole('link', { name: '编辑', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+\/edit$/)
    const reopened = page.getByRole('textbox', { name: '正文' })
    await expect(reopened.getByRole('heading', { name: '共通线', level: 2 })).toBeVisible()
    await expect(reopened.getByRole('listitem')).toHaveText(['选 A', '选 B'])
    await expect(reopened.getByRole('row')).toHaveCount(5)
    await expect(reopened.getByRole('textbox', { name: '图片说明' })).toHaveValue('分支示意图')
    await expect(page.getByRole('button', { name: '撤销' })).toBeDisabled()
    await page.getByRole('textbox', { name: '标题' }).fill(`${title} 改`)
    await expect(page.getByRole('status').filter({ hasText: '有未保存的修改' })).toBeVisible()
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByRole('status').filter({ hasText: '草稿已保存' })).toBeVisible()
    await expect(page).toHaveURL(/\/edit$/)

    await page.goto('/zh/user/2/walkthroughs')
    const written = page.getByRole('list', { name: '撰写的攻略' })
    await expect(written.getByRole('link', { name: `${title} 改` })).toHaveAttribute(
      'href',
      reading,
    )
    const shelves = page.getByRole('group', { name: '攻略状态' })
    await shelves.getByRole('button', { name: '草稿' }).click()
    await expect(page).toHaveURL(/\/zh\/user\/2\/walkthroughs\?status=draft$/)
    await expect(written.getByRole('link', { name: `${title} 改` })).toBeVisible()
    await shelves.getByRole('button', { name: '已发布' }).click()
    await expect(page).toHaveURL(/\?status=published$/)
    await expect(written.getByRole('link', { name: `${title} 改` })).toHaveCount(0)

    await page.goto(reading)
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expectNotice(page, '攻略已')
    await expect(page.getByText('这篇攻略尚未发布，仅你可见')).toHaveCount(0)
    await remove(page)
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
    await expect(page.getByText(`${title} 改`)).toHaveCount(0)
  })

  test('says what is missing and leaves unsaved writing on request', async ({ page }) => {
    await page.goto('/zh/game/2/walkthrough')
    await page.getByRole('link', { name: '写攻略' }).first().click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/new$/)
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page.getByText('请输入标题')).toBeVisible()
    await expect(page.getByText('请输入正文')).toBeVisible()
    await expect(page.getByRole('textbox', { name: '标题' })).toBeFocused()

    await page.getByRole('textbox', { name: '正文' }).click()
    await page.keyboard.type('写到一半')
    await expect(page.getByText('有未保存的修改')).toBeVisible()
    await page.evaluate(() => history.back())
    const leave = page.getByRole('alertdialog')
    await expect(leave.getByText('尚未保存的修改将会丢失')).toBeVisible()
    await leave.getByRole('button', { name: '离开' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
    await expect(leave).toBeHidden()
  })

  test('holds a walkthrough sent for publication until it is reviewed', async ({ page }) => {
    const title = `E2E 待审攻略 ${Date.now()}`
    await page.goto('/zh/game/2/walkthrough/new')
    await page.getByRole('textbox', { name: '标题' }).fill(title)
    await page.getByRole('textbox', { name: '正文' }).fill('只有一句。')
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+$/)
    await expectNotice(page, '攻略已')
    await expect(page.getByText(/这篇攻略(正在审核|未通过审核)/)).toBeVisible()
    await remove(page)
  })
})

import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

test('shows the comments of a game as threads and asks a guest to sign in before writing', async ({
  page,
}) => {
  await page.goto('/zh/game/1')
  await page.getByRole('tab', { name: /评论/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/comments$/)
  const thread = page.locator('article').filter({ hasText: 'Seeded root comment for E2E.' }).first()
  const reply = thread.locator('article').filter({ hasText: 'Seeded reply comment for E2E.' })
  await expect(reply).toBeVisible()

  await page.getByRole('button', { name: '评论内容' }).click()
  await expect(page.getByRole('dialog', { name: '登录 Shionlib' })).toBeVisible()
})

test('lists what a user wrote on their page and opens the page that holds a comment', async ({
  page,
}) => {
  await page.goto('/zh/user/2')
  await page.getByRole('tab', { name: /评论/ }).click()
  await expect(page).toHaveURL(/\/zh\/user\/2\/comments$/)
  const list = page.getByRole('list', { name: '发表的评论' })
  const written = list.getByRole('link').filter({ hasText: 'Seeded root comment for E2E.' }).first()
  await expect(written).toContainText('评论《常轨脱离Creative Re:Re:call》')
  await expect(written).toHaveAttribute('href', /^\/zh\/game\/1\/comments\?comment=\d+$/)
  await expect(list.getByRole('listitem').first().getByRole('link')).toHaveCount(1)
  await written.click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/comments#comment-\d+$/)
  await expect(
    page.locator('article').filter({ hasText: 'Seeded root comment for E2E.' }).first(),
  ).toBeInViewport()
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('writes, answers, likes, edits and deletes a comment', async ({ page }) => {
    const stamp = Date.now()
    await page.goto('/zh/game/2/comments')
    const editor = page.getByRole('textbox', { name: '评论内容' })
    const tools = page.getByRole('toolbar', { name: '格式' }).first()
    await expect(tools).toBeHidden()
    await editor.click()
    await expect(tools).toBeVisible()
    await page.keyboard.type(`补丁可用 ${stamp}`)
    await page.keyboard.press('Enter')
    await tools.getByRole('button', { name: '粗体' }).click()
    await page.keyboard.type('注意')
    await tools.getByRole('button', { name: '粗体' }).click()
    await page.keyboard.type('：')
    await tools.getByRole('button', { name: '剧透' }).click()
    await page.keyboard.type('结局有变')
    await expect(tools.getByRole('button', { name: '剧透' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await tools.getByRole('button', { name: '剧透' }).click()
    await page.keyboard.type('补丁说明')
    for (let character = 0; character < '补丁说明'.length; character += 1) {
      await page.keyboard.press('Shift+ArrowLeft')
    }
    await tools.getByRole('button', { name: '链接' }).click()
    const address = page.getByRole('textbox', { name: '链接地址' })
    await address.fill('javascript:alert(1)')
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await expect(page.getByText('请输入以 http、https 或 mailto 开头的地址')).toBeVisible()
    await address.fill('example.com/patch')
    await address.press('Enter')
    await expect(address).toBeHidden()
    await page.getByRole('button', { name: '发表', exact: true }).click()
    await expectNotice(page, '评论已发表')
    await expect(page).toHaveURL(/\/zh\/game\/2\/comments#comment-\d+$/)
    await expect(editor).toHaveText('')
    await expect(page.getByText('请输入评论内容')).toHaveCount(0)

    const mine = page
      .locator('article')
      .filter({ hasText: `补丁可用 ${stamp}` })
      .first()
    await expect(mine.getByText('审核中').first()).toBeVisible()
    await expect(mine.getByRole('button', { name: /剧透内容/ })).toBeVisible()
    await expect(mine.locator('strong')).toHaveText('注意')
    const link = mine.getByRole('link', { name: '补丁说明' })
    await expect(link).toHaveAttribute('href', 'https://example.com/patch')
    await expect(link).toHaveAttribute('rel', /nofollow/)

    await mine.getByRole('button', { name: '回复', exact: true }).click()
    await page.getByRole('textbox', { name: '回复 e2e_user' }).fill(`收到 ${stamp}`)
    await mine.getByRole('button', { name: '回复', exact: true }).last().click()
    await expectNotice(page, '评论已发表')
    await expect(mine.locator('article').filter({ hasText: `收到 ${stamp}` })).toBeVisible()

    const like = mine.getByRole('button', { name: '赞', exact: true }).first()
    await like.click()
    await expect(mine.getByRole('button', { name: '取消赞' }).first()).toHaveText('1')

    await mine.getByRole('button', { name: '更多操作' }).first().click()
    await page.getByRole('menuitem', { name: '编辑' }).click()
    const editing = page.getByRole('textbox', { name: '编辑评论' })
    await expect(editing).toContainText(`补丁可用 ${stamp}`)
    await expect(editing.locator('strong')).toHaveText('注意')
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
    await editing.fill(`补丁已更新 ${stamp}`)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expectNotice(page, '评论已保存')
    const edited = page
      .locator('article')
      .filter({ hasText: `补丁已更新 ${stamp}` })
      .first()
    await expect(edited.getByText('已编辑').first()).toBeVisible()

    await edited.getByRole('button', { name: '更多操作' }).first().click()
    await page.getByRole('menuitem', { name: '删除' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.getByText('评论删除后无法恢复，其下的回复将保留')).toBeVisible()
    await confirm.getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '评论已删除')
    await expect(page.getByText(`补丁已更新 ${stamp}`)).toHaveCount(0)
    await expect(page.getByText(`收到 ${stamp}`)).toBeVisible()
  })

  test('shows the first replies of a thread and the rest on request', async ({ page }) => {
    const stamp = Date.now()
    await page.goto('/zh/game/2/comments')
    await page.getByRole('textbox', { name: '评论内容' }).click()
    await page.keyboard.type(`有四条回复 ${stamp}`)
    await page.keyboard.press('Control+Enter')
    await expectNotice(page, '评论已发表')
    const thread = page
      .locator('article')
      .filter({ hasText: `有四条回复 ${stamp}` })
      .first()
    for (const number of [1, 2, 3, 4]) {
      await thread.getByRole('button', { name: '回复', exact: true }).first().click()
      await page.getByRole('textbox', { name: '回复 e2e_user' }).fill(`第 ${number} 条 ${stamp}`)
      await page.keyboard.press('Control+Enter')
      await expect(
        thread.locator('article').filter({ hasText: `第 ${number} 条 ${stamp}` }),
      ).toBeVisible()
    }

    await page.goto('/zh/game/2/comments')
    await expect(thread.locator('article')).toHaveCount(3)
    await thread.getByRole('button', { name: '查看其余 1 条回复' }).click()
    await expect(thread.locator('article')).toHaveCount(4)
    await thread.getByRole('button', { name: '收起回复' }).click()
    await expect(thread.locator('article')).toHaveCount(3)
  })

  test('orders the threads oldest first on request', async ({ page }) => {
    const text = `排序用的评论 ${Date.now()}`
    await page.goto('/zh/game/1/comments')
    await page.getByRole('textbox', { name: '评论内容' }).click()
    await page.keyboard.type(text)
    await page.getByRole('button', { name: '发表', exact: true }).click()
    await expectNotice(page, '评论已发表')
    await expect(page.locator('article').first()).toContainText(text)

    await page
      .getByRole('group', { name: '排序方式' })
      .getByRole('button', { name: '最早' })
      .click()
    await expect(page).toHaveURL(/\/zh\/game\/1\/comments\?order=oldest$/)
    await expect(page.locator('article').first()).toContainText('Seeded root comment for E2E.')

    const mine = page.locator('article').filter({ hasText: text }).first()
    await mine.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '删除' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '评论已删除')
  })
})

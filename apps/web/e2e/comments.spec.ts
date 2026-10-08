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
  await expect(reply.getByText('回复 e2e_user')).toBeVisible()

  await page.getByRole('button', { name: '登录后发表评论' }).click()
  await expect(page.getByRole('dialog', { name: '登录 Shionlib' })).toBeVisible()
})

test('lists what a user wrote on their page and leads to the comment', async ({ page }) => {
  await page.goto('/zh/user/2')
  await page.getByRole('tab', { name: /评论/ }).click()
  await expect(page).toHaveURL(/\/zh\/user\/2\/comments$/)
  const list = page.getByRole('list', { name: '发表的评论' })
  await expect(list.getByText('Seeded root comment for E2E.')).toBeVisible()
  await expect(list.getByRole('link', { name: '常轨脱离Creative Re:Re:call' })).toHaveAttribute(
    'href',
    /^\/zh\/game\/1\/comments#comment-\d+$/,
  )
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('writes, answers, likes, edits and deletes a comment', async ({ page }) => {
    const stamp = Date.now()
    await page.goto('/zh/game/2/comments')
    const editor = page.getByRole('textbox', { name: '写评论' })
    await editor.fill(`补丁可用 ${stamp}\n[b]注意[/b]：[spoiler]结局有变[/spoiler]`)
    await page.getByRole('button', { name: '发表', exact: true }).click()
    await expectNotice(page, '评论已发表。')
    await expect(editor).toHaveValue('')
    await expect(page.getByText('请输入评论内容。')).toHaveCount(0)

    const mine = page
      .locator('article')
      .filter({ hasText: `补丁可用 ${stamp}` })
      .first()
    await expect(mine.getByText('审核中').first()).toBeVisible()
    await expect(mine.getByRole('button', { name: /剧透内容/ })).toBeVisible()

    await mine.getByRole('button', { name: '回复', exact: true }).click()
    await page.getByRole('textbox', { name: '回复 e2e_user' }).fill(`收到 ${stamp}`)
    await mine.getByRole('button', { name: '回复', exact: true }).last().click()
    await expectNotice(page, '评论已发表。')
    const answer = mine.locator('article').filter({ hasText: `收到 ${stamp}` })
    await expect(answer.getByText('回复 e2e_user')).toBeVisible()

    const like = mine.getByRole('button', { name: '赞', exact: true }).first()
    await like.click()
    await expect(mine.getByRole('button', { name: '取消赞' }).first()).toHaveText('1')

    await mine.getByRole('button', { name: '评论操作' }).first().click()
    await page.getByRole('menuitem', { name: '编辑' }).click()
    const editing = page.getByRole('textbox', { name: '编辑评论' })
    await expect(editing).toHaveValue(`补丁可用 ${stamp}\n[b]注意[/b]：[spoiler]结局有变[/spoiler]`)
    await editing.fill(`补丁已更新 ${stamp}`)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expectNotice(page, '评论已保存。')
    const edited = page
      .locator('article')
      .filter({ hasText: `补丁已更新 ${stamp}` })
      .first()
    await expect(edited.getByText('已编辑').first()).toBeVisible()

    await edited.getByRole('button', { name: '评论操作' }).first().click()
    await page.getByRole('menuitem', { name: '删除' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.getByText('删除后无法恢复，它的回复会保留。')).toBeVisible()
    await confirm.getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '评论已删除。')
    await expect(page.getByText(`补丁已更新 ${stamp}`)).toHaveCount(0)
    await expect(page.getByText(`收到 ${stamp}`)).toBeVisible()
  })

  test('orders the threads oldest first on request', async ({ page }) => {
    await page.goto('/zh/game/1/comments')
    await page.getByRole('combobox', { name: '评论顺序' }).click()
    await page.getByRole('option', { name: '最早优先' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/1\/comments\?order=oldest$/)
    await expect(page.getByText('Seeded root comment for E2E.')).toBeVisible()
  })
})

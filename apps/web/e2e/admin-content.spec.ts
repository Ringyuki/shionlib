import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const heldComment = 'Seeded comment awaiting review: join the group for save files.'
const heldWalkthrough = 'Seeded walkthrough awaiting review.'
const author = 'e2e_managed_user'

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('lists held comments and walkthroughs among what waits', async ({ page }) => {
    await page.goto('/zh/admin')
    const waiting = page.getByRole('table', { name: '待处理' })
    const comment = waiting.getByRole('row', { name: new RegExp(heldComment) })
    await expect(comment).toContainText('AI 判定为垃圾信息，把握 0.71')
    await expect(waiting.getByRole('row', { name: new RegExp(heldWalkthrough) })).toContainText(
      '攻略',
    )
    const navigation = page.getByRole('navigation', { name: '主导航' })
    await expect(navigation.getByRole('link', { name: '评论' })).toContainText('1 项待处理')
    await expect(navigation.getByRole('link', { name: '攻略' })).toContainText('1 项待处理')
    await comment.click()
    await expect(page).toHaveURL(/\/zh\/admin\/comments\?id=\d+$/)
    await expect(page.getByRole('dialog', { name: '复核评论' })).toBeVisible()
  })

  test('searches comments and shows those of one author', async ({ page }) => {
    await page.goto('/zh/admin/comments')
    const comments = page.getByRole('table', { name: '评论' })
    await expect(comments.getByRole('row', { name: new RegExp(heldComment) })).toContainText(
      '待复核',
    )
    await page.getByRole('button', { name: '全部', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/comments\?status=ALL$/)
    await page.getByRole('searchbox', { name: '搜索评论内容' }).fill('join the group')
    await expect(page).toHaveURL(/\/zh\/admin\/comments\?status=ALL&q=join\+the\+group$/)
    await expect(comments.getByRole('row')).toHaveCount(2)

    await page.goto('/zh/admin/users?q=e2e_managed_user')
    await page.getByRole('row', { name: /e2e_managed_user@/ }).click()
    await page.getByRole('link', { name: '1 条评论' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/comments\?status=ALL&author=\d+$/)
    await expect(page.getByText(`作者：${author}`)).toBeVisible()
    await expect(comments.getByRole('row', { name: new RegExp(heldComment) })).toBeVisible()
  })

  test('offers the actions for several comments once some are chosen', async ({ page }) => {
    await page.goto('/zh/admin/comments?status=ALL')
    const comments = page.getByRole('table', { name: '评论' })
    await comments.getByRole('row').nth(1).getByRole('checkbox').check()
    await comments.getByRole('row').nth(2).getByRole('checkbox').check()
    await expect(page.getByText('已选 2 条')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: '搜索评论内容' })).toHaveCount(0)
    await page.getByRole('button', { name: '屏蔽' }).click()
    const dialog = page.getByRole('dialog', { name: '屏蔽 2 条评论' })
    await expect(dialog.getByRole('combobox', { name: '类别' })).toContainText('垃圾信息')
    await dialog.getByRole('button', { name: '取消' }).click()
    await page.getByRole('button', { name: '取消选择' }).click()
    await expect(page.getByRole('searchbox', { name: '搜索评论内容' })).toBeVisible()
  })

  test('reviews a held comment with what the models said', async ({ page }) => {
    await page.goto('/zh/admin/comments')
    await page.getByRole('row', { name: new RegExp(heldComment) }).click()
    const review = page.getByRole('dialog', { name: '复核评论' })
    await expect(review).toContainText(heldComment)
    await expect(review).toContainText(author)
    await expect(review).toContainText('发表过 1 条评论')
    await expect(review).toContainText('e2e-review-model')
    await expect(review).toContainText('依据：「join the group for save files」')
    await expect(review.getByRole('progressbar', { name: '垃圾信息' })).toBeVisible()
    await review.getByRole('button', { name: '提交' }).click()
    await expect(review.getByText('请选择复核结果')).toBeVisible()

    await review.getByRole('radio', { name: /屏蔽/ }).click()
    await expect(review.getByRole('combobox', { name: '类别' })).toContainText('垃圾信息')
    await review.getByRole('textbox', { name: '说明' }).fill('Blocked by E2E')
    await review.getByRole('switch', { name: '通知作者' }).click()
    await review.getByRole('button', { name: '提交' }).click()
    await expectNotice(page, '评论已屏蔽')
    await expect(review).toBeHidden()
    await expect(page.getByText('没有待复核的评论')).toBeVisible()

    await page.getByRole('button', { name: '已屏蔽' }).click()
    await page.getByRole('row', { name: new RegExp(heldComment) }).click()
    const kept = page.getByRole('dialog', { name: '评论详情' })
    await kept.getByRole('radio', { name: /通过/ }).click()
    await kept.getByRole('button', { name: '提交' }).click()
    await expectNotice(page, '评论已通过')
  })

  test('hides a held walkthrough after reading it', async ({ page }) => {
    await page.goto('/zh/admin/walkthroughs')
    const row = page.getByRole('row', { name: new RegExp(heldWalkthrough) })
    await expect(row).toContainText('待复核')
    await expect(row).toContainText('草稿')
    await page.getByRole('button', { name: /^待复核/ }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/walkthroughs\?status=HELD$/)
    await row.click()
    const pane = page.getByRole('dialog', { name: '攻略' })
    await expect(pane).toContainText('Read the common route first.')
    await expect(pane).toContainText('Common route')
    await expect(pane).toContainText('2 个步骤')
    await expect(pane).toContainText('无意义内容')
    await pane.getByRole('button', { name: '提交' }).click()
    await expect(pane.getByText('请选择处理结果')).toBeVisible()
    await pane.getByRole('radio', { name: /^隐藏/ }).click()
    await pane.getByRole('button', { name: '提交' }).click()
    await expectNotice(page, '攻略已隐藏')
    await expect(pane).toBeHidden()
    await page.getByRole('button', { name: '已隐藏' }).click()
    await expect(page.getByRole('row', { name: new RegExp(heldWalkthrough) })).toContainText(
      '已隐藏',
    )
  })
})

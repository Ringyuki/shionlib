import { expect, type Page } from '@playwright/test'
import { openSignIn, sessionFile, signIn } from './support/accounts'
import { test } from './support/ingress'
import { expectNotice } from './support/notices'

const reporter = 'e2e_list_safe_user'

function inbox(page: Page) {
  return page.getByRole('list', { name: '消息列表' }).getByRole('listitem')
}

function entry(page: Page) {
  return page.getByRole('link', { name: /消息/ }).first()
}

test('asks a guest to sign in', async ({ page }) => {
  await page.goto('/zh/message')
  await expect(page.getByText('登录后可以查看消息')).toBeVisible()
})

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('adds a message to the open inbox when it arrives', async ({ page, secondBrowser }) => {
    await page.goto('/zh/message')
    const reports = inbox(page).filter({ hasText: '有新的资源举报' })
    const before = await reports.count()

    await secondBrowser.clearCookies()
    const other = await secondBrowser.newPage()
    await openSignIn(other)
    await signIn(other, reporter)
    await other.goto('/zh/game/1')
    await other.locator('#resource-1').getByRole('button', { name: '资源操作' }).click()
    await other.getByRole('menuitem', { name: '举报' }).click()
    await other
      .getByRole('dialog', { name: '举报资源' })
      .getByRole('button', { name: '提交举报' })
      .click()
    await expectNotice(other, '已收到举报，我们将尽快处理')

    await expect(reports).toHaveCount(before + 1)
    await expect(reports.first().getByText('未读', { exact: true })).toBeVisible()
    await expect(entry(page)).toContainText('条未读')
  })

  test('reads a message written in the language of the page', async ({ page }) => {
    await page.goto('/zh/message')
    await expect(page.getByText('Messages.System')).toHaveCount(0)
    const first = inbox(page).filter({ hasText: '有新的资源举报' }).first()
    await expect(first).toContainText(`${reporter} 举报了`)
    await first.getByRole('link').click()
    await expect(page).toHaveURL(/\/zh\/message\?m=\d+$/)
    const opened = page.getByRole('article')
    await expect(opened.getByRole('heading', { name: '有新的资源举报', level: 2 })).toBeVisible()
    await expect(opened.getByRole('link', { name: '前往处理' })).toHaveAttribute(
      'href',
      /^\/zh\/admin\/reports\?id=\d+$/,
    )
    await expect(first.getByText('未读', { exact: true })).toHaveCount(0)

    const id = new URL(page.url()).searchParams.get('m') ?? ''
    await page.goto(`/en/message?m=${id}`)
    await expect(
      page.getByRole('article').getByRole('heading', { name: 'New resource report', level: 2 }),
    ).toBeVisible()
  })

  test('follows the unread count live and marks everything read', async ({ page }) => {
    await page.goto('/zh')
    await page.evaluate(() =>
      fetch('/api/message/all/read', { method: 'POST', credentials: 'include' }),
    )
    await page.reload()
    await expect(entry(page)).not.toContainText('条未读')
    await page.evaluate(() =>
      fetch('/api/message/all/unread', { method: 'POST', credentials: 'include' }),
    )
    await expect(entry(page)).toContainText('条未读')

    await entry(page).click()
    await expect(page).toHaveURL(/\/zh\/message$/)
    await page.getByRole('button', { name: '全部标为已读' }).click()
    await expect(page.getByText('没有未读消息')).toBeVisible()
    await expect(page.getByRole('button', { name: '全部标为已读' })).toBeDisabled()
    await expect(entry(page)).not.toContainText('条未读')
  })

  test('keeps the old addresses of the categories', async ({ page }) => {
    await page.goto('/zh/message/comment-reply')
    await expect(page.getByText('暂无回复。')).toBeVisible()
    await page.getByRole('button', { name: '系统' }).click()
    await expect(page).toHaveURL(/\/zh\/message\/system$/)
    await expect(inbox(page).first()).toBeVisible()
    await page.goto('/zh/message/spam')
    await expect(page.getByText('404')).toBeVisible()
  })
})

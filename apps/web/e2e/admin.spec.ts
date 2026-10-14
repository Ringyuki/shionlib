import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const seededReport = 'Seeded report for the admin review flow.'
const heldFile = 'seeded-malware-sample.zip'
const stalledFile = 'seeded-stalled-sample.7z'

function adminNavigation(page: Page) {
  return page.getByRole('navigation', { name: '主导航' })
}

test('asks a guest to sign in', async ({ page }) => {
  const response = await page.goto('/zh/admin')
  expect(response?.status()).toBe(401)
  await expect(page.getByText('需要登录')).toBeVisible()
  await expect(adminNavigation(page).getByRole('link', { name: '举报' })).toHaveCount(0)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('is refused and finds no entry to the admin panel', async ({ page }) => {
    const response = await page.goto('/zh/admin/reports')
    expect(response?.status()).toBe(403)
    await expect(page.getByText('没有权限', { exact: true })).toBeVisible()
    await expect(adminNavigation(page).getByRole('link', { name: '首页' })).toBeVisible()
    await page.getByRole('button', { name: /e2e_user/ }).click()
    await expect(page.getByRole('menuitem', { name: '个人主页' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '管理后台' })).toHaveCount(0)
  })
})

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })

  test('enters from the account menu and returns to the site', async ({ page }) => {
    await page.goto('/zh')
    await page.getByRole('button', { name: /e2e_admin/ }).click()
    await page.getByRole('menuitem', { name: '管理后台' }).click()
    await expect(page).toHaveURL(/\/zh\/admin$/)
    await expect(page.getByRole('heading', { name: '概览', level: 1 })).toBeVisible()
    await expect(page).toHaveTitle('概览 | Shionlib')
    const navigation = adminNavigation(page)
    await expect(navigation.getByRole('link', { name: '概览' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(navigation.getByRole('link', { name: '举报' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: '文件检查' })).toBeVisible()
    await expect(page.getByRole('link', { name: '上传资源' })).toHaveCount(0)
    await expect(page.getByRole('contentinfo')).toHaveCount(0)
    await navigation.getByRole('link', { name: '返回站点' }).click()
    await expect(page).toHaveURL(/\/zh$/)
    await expect(page.getByRole('link', { name: '上传资源' })).toBeVisible()
  })

  test('stays in Chinese under an address of another language', async ({ page }) => {
    await page.goto('/en/admin/reports?status=ALL')
    await expect(page).toHaveURL(/\/zh\/admin\/reports\?status=ALL$/)
    await expect(page.getByRole('heading', { name: '举报', level: 1 })).toBeVisible()
    await page.goto('/admin/checks')
    await expect(page).toHaveURL(/\/zh\/admin\/checks$/)
  })

  test('lists what waits on the overview and opens an item', async ({ page }) => {
    await page.goto('/zh/admin')
    const waiting = page.getByRole('table', { name: '待处理' })
    await expect(waiting.getByRole('row', { name: new RegExp(stalledFile) })).toContainText(
      '检查未完成',
    )
    const held = waiting.getByRole('row').filter({ hasText: '病毒复核' })
    await expect(held).toContainText(heldFile)
    await expect(held).toContainText('Eicar-Test-Signature')
    await expect(held).toContainText('自动删除')
    await held.click()
    await expect(page).toHaveURL(/\/zh\/admin\/checks\?case=\d+$/)
    await expect(page.getByRole('dialog', { name: '复核文件' })).toBeVisible()
  })

  test('shows the site figures for the chosen range', async ({ page }) => {
    await page.goto('/zh/admin')
    await expect(page.getByRole('img', { name: '每日下载与浏览' })).toBeVisible()
    await expect(page.getByText('累计下载')).toBeVisible()
    await expect(page.getByText('暂存盘')).toBeVisible()
    await page.getByRole('button', { name: '7 天' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\?days=7$/)
    await expect(page.getByRole('img', { name: '每日下载与浏览' })).toBeVisible()
  })

  test('filters reports in the address', async ({ page }) => {
    await page.goto('/zh/admin/reports')
    const reports = page.getByRole('table', { name: '举报' })
    await expect(reports.getByRole('row', { name: new RegExp(seededReport) })).toBeVisible()
    await page.getByRole('button', { name: '不成立', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/reports\?status=INVALID$/)
    await expect(page.getByRole('row', { name: new RegExp(seededReport) })).toHaveCount(0)
    await page.getByRole('combobox', { name: '原因' }).click()
    await page.getByRole('option', { name: '含有病毒' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/reports\?status=INVALID&reason=MALWARE$/)
    await expect(page.getByText('没有符合条件的举报')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/zh\/admin\/reports\?status=INVALID$/)
  })

  test('opens the file check that an older notice links to', async ({ page }) => {
    await page.goto('/zh/admin/checks')
    await page
      .getByRole('table', { name: '等待复核' })
      .getByRole('row', { name: new RegExp(heldFile) })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/checks\?case=\d+$/)
    const id = new URL(page.url()).searchParams.get('case') ?? ''
    await page.goto(`/zh/admin/malware-scans?id=${id}`)
    await expect(page).toHaveURL(new RegExp(`/zh/admin/checks\\?case=${id}$`))
    await expect(page.getByRole('dialog', { name: '复核文件' })).toBeVisible()
  })

  test('explains a review of a held file and decides nothing without a choice', async ({
    page,
  }) => {
    await page.goto('/zh/admin/checks')
    const waiting = page.getByRole('table', { name: '等待复核' })
    const row = waiting.getByRole('row', { name: new RegExp(heldFile) })
    await expect(row).toContainText('Eicar-Test-Signature')
    await row.getByRole('button', { name: '放行' }).click()
    const quick = page.getByRole('alertdialog')
    await expect(quick).toContainText(`确定要放行「${heldFile}」吗？`)
    await quick.getByRole('button', { name: '取消' }).click()
    await expect(quick).toBeHidden()
    await expect(page).toHaveURL(/\/zh\/admin\/checks$/)

    await row.click()
    const review = page.getByRole('dialog', { name: '复核文件' })
    await expect(review).toContainText('仍未复核的，文件将被自动删除')
    await expect(review).toContainText('e2e_admin')
    await expect(review).toContainText('累计 3 次时自动封禁 30 天')
    await review.getByRole('button', { name: '提交' }).click()
    await expect(review.getByText('请选择复核结果')).toBeVisible()
    await review.getByRole('button', { name: '取消' }).click()
    await expect(review).toBeHidden()
    await expect(page).toHaveURL(/\/zh\/admin\/checks$/)
    await expect(row).toBeVisible()
  })

  test('acts on the chosen held files together', async ({ page }) => {
    await page.goto('/zh/admin/checks')
    const waiting = page.getByRole('table', { name: '等待复核' })
    const row = waiting.getByRole('row', { name: new RegExp(heldFile) })
    await row.getByRole('checkbox').check()
    const bar = page.getByText('已选 1 条').locator('..')
    await expect(bar).toBeVisible()
    await bar.getByRole('button', { name: '删除' }).click()
    const quick = page.getByRole('alertdialog')
    await expect(quick).toContainText(`确定要删除「${heldFile}」吗？`)
    await quick.getByRole('button', { name: '取消' }).click()
    await expect(quick).toBeHidden()
    await bar.getByRole('button', { name: '取消选择' }).click()
    await expect(page.getByText('已选 1 条')).toHaveCount(0)
    await expect(row.getByRole('checkbox')).not.toBeChecked()
  })

  test.describe('changing what waits', () => {
    test.describe.configure({ mode: 'serial', retries: 0 })

    test('reviews a report and keeps the outcome', async ({ page }) => {
      await page.goto('/zh/admin/reports')
      await page.getByRole('row', { name: new RegExp(seededReport) }).click()
      await expect(page).toHaveURL(/\/zh\/admin\/reports\?id=\d+$/)
      const review = page.getByRole('dialog', { name: '处理举报' })
      await expect(review).toContainText('文件无法下载')
      await expect(review).toContainText('e2e_user')
      await expect(review).toContainText(heldFile)
      await review.getByRole('button', { name: '提交' }).click()
      await expect(review.getByText('请选择处理结论')).toBeVisible()

      await review.getByRole('radio', { name: /不成立/ }).click()
      await expect(review.getByText('这是 e2e_user 的第 1 次无效举报')).toBeVisible()
      await review.getByRole('radio', { name: /^成立/ }).click()
      await expect(review.getByText('低：不处罚上传者')).toBeVisible()
      await review.getByRole('button', { name: '中', exact: true }).click()
      await expect(review.getByText('中：上传者记一次违规')).toBeVisible()
      await review.getByRole('button', { name: '低', exact: true }).click()
      await review.getByRole('textbox', { name: '处理说明' }).fill('Reviewed by E2E')
      await review.getByRole('switch', { name: '通知举报人和上传者' }).click()
      await review.getByRole('button', { name: '提交' }).click()
      await expectNotice(page, '举报已处理')
      await expect(review).toBeHidden()
      await expect(page).toHaveURL(/\/zh\/admin\/reports$/)
      await expect(page.getByRole('row', { name: new RegExp(seededReport) })).toHaveCount(0)

      await page.getByRole('button', { name: '成立', exact: true }).click()
      const done = page.getByRole('row', { name: new RegExp(seededReport) })
      await expect(done).toContainText('成立 · 低')
      await done.click()
      const outcome = page.getByRole('dialog', { name: '举报详情' })
      await expect(outcome).toContainText('Reviewed by E2E')
      await expect(outcome).toContainText('e2e_admin')
      await expect(outcome.getByRole('button', { name: '提交' })).toHaveCount(0)
    })

    test('checks a stalled file again', async ({ page }) => {
      await page.goto('/zh/admin/checks')
      const stalled = page.getByRole('table', { name: '检查未完成' })
      const row = stalled.getByRole('row', { name: new RegExp(stalledFile.replace('.', '\\.')) })
      await expect(row).toContainText('scan service did not answer')
      await expect(row).toContainText('已尝试 6 次')
      await row.getByRole('checkbox').check()
      await page
        .getByText('已选 1 条')
        .locator('..')
        .getByRole('button', { name: '重新检查' })
        .click()
      const confirm = page.getByRole('alertdialog')
      await expect(confirm).toContainText(`确定要重新检查「${stalledFile}」吗？`)
      await confirm.getByRole('button', { name: '重新检查' }).click()
      await expectNotice(page, '已重新开始检查')
      await expect(confirm).toBeHidden()
      await expect(row).toHaveCount(0)
      await expect(page.getByText('已选 1 条')).toHaveCount(0)
    })
  })
})

import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const unpaid = 'e2e-order-unpaid'
const expired = 'e2e-order-expired'

function orders(page: Page) {
  return page.getByRole('table', { name: '赞助' })
}

function figure(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..')
}

async function choose(page: Page, order: string, action: string) {
  await page.getByRole('button', { name: `订单 ${order} 的操作` }).click()
  await page.getByRole('menuitem', { name: action, exact: true }).click()
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('shows the totals and every order with who paid it', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '赞助' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/sponsors$/)
    await expect(page.getByRole('heading', { name: '赞助', level: 1 })).toBeVisible()
    await expect(figure(page, '累计金额')).toContainText('$25.00')
    await expect(figure(page, '已完成的订单')).toContainText('2')
    await expect(figure(page, '本月金额')).toContainText('$20.00')
    await expect(figure(page, '赞助功能').getByRole('link', { name: '设置' })).toHaveAttribute(
      'href',
      '/zh/admin/settings',
    )

    await expect(orders(page).getByRole('row')).toHaveCount(6)
    const member = orders(page).getByRole('row', { name: /e2e-order-member/ })
    await expect(member).toContainText('e2e_user')
    await expect(member).toContainText('$20.00')
    await expect(member).toContainText('支付宝')
    await expect(member).toContainText('Seeded sponsor message.')
    await expect(member).toContainText('已完成')
    const anonymous = orders(page).getByRole('row', { name: /e2e-order-anonymous/ })
    await expect(anonymous).toContainText('匿名')
    await expect(anonymous).toContainText('不公开展示')
    await expect(anonymous).toContainText('微信支付')
    await expect(orders(page).getByRole('row', { name: new RegExp(unpaid) })).toContainText(
      'Seeded Guest',
    )
  })

  test('narrows the orders by their status in the address', async ({ page }) => {
    await page.goto('/zh/admin/sponsors')
    await page.getByRole('button', { name: '已退款', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/sponsors\?status=REFUND$/)
    await expect(orders(page).getByRole('row')).toHaveCount(2)
    await expect(orders(page).getByRole('row', { name: /e2e-order-refunded/ })).toContainText(
      '$8.00',
    )
    await page.getByRole('button', { name: '全部', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/sponsors$/)
    await expect(orders(page).getByRole('row')).toHaveCount(6)
  })

  test('completes an order by hand, then marks it refunded', async ({ page }) => {
    await page.goto('/zh/admin/sponsors')
    const row = orders(page).getByRole('row', { name: new RegExp(unpaid) })
    await expect(row).toContainText('未支付')

    await choose(page, unpaid, '标为已完成')
    const confirm = page.getByRole('alertdialog', { name: '确定要将订单标为已完成吗？' })
    await expect(confirm).toContainText(`订单 ${unpaid}，$10.00。`)
    await expect(confirm).toContainText('这个订单没有关联账号，不会发放赞助徽章。')
    await confirm.getByRole('button', { name: '标为已完成' }).click()
    await expectNotice(page, '订单已标为已完成')
    await expect(row).toContainText('已完成')
    await expect(figure(page, '累计金额')).toContainText('$35.00')
    await expect(figure(page, '已完成的订单')).toContainText('3')
    await expect(figure(page, '本月金额')).toContainText('$30.00')

    await choose(page, unpaid, '标为已退款')
    await expectNotice(page, '订单已标为已退款')
    await expect(row).toContainText('已退款')
    await expect(figure(page, '累计金额')).toContainText('$25.00')
  })

  test('deletes an order after asking', async ({ page }) => {
    await page.goto('/zh/admin/sponsors?status=EXPIRED')
    await expect(orders(page).getByRole('row')).toHaveCount(2)
    await choose(page, expired, '删除订单')
    const confirm = page.getByRole('alertdialog', { name: '确定要删除这个订单吗？' })
    await expect(confirm).toContainText(`订单 ${expired}，$3.00。`)
    await confirm.getByRole('button', { name: '取消' }).click()
    await expect(orders(page).getByRole('row')).toHaveCount(2)

    await choose(page, expired, '删除订单')
    await confirm.getByRole('button', { name: '删除', exact: true }).click()
    await expectNotice(page, '订单已删除')
    await expect(page.getByText('没有这个状态的订单')).toBeVisible()
  })
})

test('keeps the orders from members', async ({ browser }) => {
  const context = await browser.newContext({ storageState: sessionFile('member') })
  const page = await context.newPage()
  const response = await page.goto('/zh/admin/sponsors')
  expect(response?.status()).toBe(403)
  await context.close()
})

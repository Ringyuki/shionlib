import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'

const paid = '/zh/sponsor/orders/7'

test('shows each sponsor once with what they wrote, and no amounts', async ({ page }) => {
  await page.goto('/zh')
  await page.getByLabel('站点信息').getByRole('link', { name: '赞助' }).click()
  await expect(page).toHaveURL(/\/zh\/sponsor$/)
  await expect(page.getByRole('heading', { name: '赞助墙', level: 1 })).toBeVisible()

  const wall = page.getByLabel('赞助者', { exact: true })
  const member = wall.getByRole('link', { name: /e2e_user/ })
  await expect(member).toHaveCount(1)
  await expect(member).toHaveAttribute('href', '/zh/user/2')
  await expect(member).toContainText('Seeded sponsor message.')
  await expect(wall).not.toContainText('Earlier seeded message.')

  await expect(wall).toContainText('Seeded Passerby')
  await expect(wall).toContainText('Seeded guest message.')
  await expect(wall.getByRole('link', { name: /Seeded Passerby/ })).toHaveCount(0)
  await expect(wall).not.toContainText('匿名')
  await expect(wall).not.toContainText('$')
})

test('tells that sponsorship is closed and keeps the checkout shut', async ({ page }) => {
  await page.goto('/zh/sponsor')
  await expect(page.getByText('暂未开放赞助')).toBeVisible()
  await expect(page.getByRole('link', { name: '成为赞助者' })).toHaveCount(0)

  await page.goto('/zh/sponsor/new')
  await expect(page).toHaveURL(/\/zh\/sponsor$/)
  await expect(page.getByRole('heading', { name: '赞助墙', level: 1 })).toBeVisible()
})

test.describe('as the member who paid', () => {
  test.use({ storageState: sessionFile('member') })

  test('shows the receipt of a paid order with its card on the wall', async ({ page }) => {
    await page.goto(paid)
    await expect(page.getByText('感谢你的赞助')).toBeVisible()
    const main = page.getByRole('main')
    await expect(main).toContainText('e2e-order-member')
    await expect(main).toContainText('$20.00')
    await expect(main).toContainText('支付宝')
    await expect(main).toContainText('Seeded sponsor message.')
    await expect(page.getByRole('button', { name: '复制订单号' })).toBeVisible()

    await page.getByRole('link', { name: '查看赞助墙' }).click()
    await expect(page).toHaveURL(/\/zh\/sponsor$/)
  })
})

test('keeps an order from everyone but who paid it', async ({ browser, page }) => {
  const asGuest = await page.goto(paid)
  expect(asGuest?.status()).toBe(404)

  const context = await browser.newContext({ storageState: sessionFile('admin') })
  const other = await context.newPage()
  const asAnother = await other.goto(paid)
  expect(asAnother?.status()).toBe(404)
  await context.close()
})

import { expect, test } from '@playwright/test'

test('lists the releases of a month by day and moves between months', async ({ page }) => {
  await page.goto('/zh')
  await page.getByRole('link', { name: '新作', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/release$/)
  await expect(page.getByRole('button', { name: '回到本月' })).toBeDisabled()

  await page.goto('/zh/release?month=2025-05')
  await page.getByRole('link', { name: '上个月' }).click()
  await expect(page).toHaveURL(/\/zh\/release\?month=2025-04$/)
  await expect(page.getByRole('heading', { name: '2025年4月', level: 2 })).toBeVisible()
  const day = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /^4月25日/ }) })
  await expect(day.getByRole('link', { name: /常轨脱离Creative Re:Re:call/ })).toHaveAttribute(
    'href',
    '/zh/game/1',
  )

  await page.getByRole('switch', { name: '仅显示有资源的游戏' }).click()
  await expect(page).toHaveURL(/\/zh\/release\?month=2025-04&resources=required$/)
  await page.getByRole('button', { name: '回到本月' }).click()
  await expect(page).toHaveURL(/\/zh\/release\?resources=required$/)
})

test('falls back on the current month for an address it cannot read', async ({ page }) => {
  await page.goto('/zh/release?month=2025-13')
  await expect(page.getByRole('button', { name: '回到本月' })).toBeDisabled()
})

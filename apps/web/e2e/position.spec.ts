import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 400 } })

const settleMs = 800

function mainArea(page: Page) {
  return page.locator('[data-scroll-restore="main"] > [data-overlayscrollbars-viewport]')
}

async function scrolledToTabs(page: Page): Promise<number> {
  await page.goto('/zh/game/1')
  await page.getByRole('tablist').scrollIntoViewIfNeeded()
  const position = await mainArea(page).evaluate(area => area.scrollTop)
  expect(position).toBeGreaterThan(0)
  return position
}

test('keeps the page where it is when the tab changes', async ({ page }) => {
  const position = await scrolledToTabs(page)
  await page.getByRole('tab', { name: /简介/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/info$/)
  await expect(page.getByRole('region', { name: '简介' })).toBeVisible()
  await page.waitForTimeout(settleMs)
  expect(await mainArea(page).evaluate(area => area.scrollTop)).toBe(position)
})

test('starts another page at the top and comes back to where it was', async ({ page }) => {
  const position = await scrolledToTabs(page)
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '开发商' })
    .click()
  await expect(page).toHaveURL(/\/zh\/developer$/)
  await expect.poll(() => mainArea(page).evaluate(area => area.scrollTop)).toBe(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/zh\/game\/1$/)
  await expect.poll(() => mainArea(page).evaluate(area => area.scrollTop)).toBe(position)
})

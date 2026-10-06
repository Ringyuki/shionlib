import { expect, test } from '@playwright/test'

test('opens the search palette with the slash key', async ({ page }) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog').getByPlaceholder('搜索游戏、开发商、角色')).toBeFocused()
})

test('sends the legacy search URL to the search page', async ({ page }) => {
  await page.goto('/zh/search/game?q=Re')
  await expect(page).toHaveURL(/\/zh\/search\?q=Re$/)
})

test('negotiates the language from the root URL', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/zh$/)
})

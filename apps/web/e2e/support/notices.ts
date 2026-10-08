import { expect, type Page } from '@playwright/test'

export async function expectNotice(page: Page, text: string) {
  const notices = page.locator('[aria-label="通知"]')
  await expect(notices.locator('li').filter({ hasText: text })).toBeVisible({ timeout: 15_000 })
}

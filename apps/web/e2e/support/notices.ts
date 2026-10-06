import { expect, type Page } from '@playwright/test'

export async function expectNotice(page: Page, text: string) {
  const notices = page.getByRole('region', { name: '通知' })
  await expect(notices.getByRole('listitem').filter({ hasText: text })).toBeVisible({
    timeout: 15_000,
  })
}

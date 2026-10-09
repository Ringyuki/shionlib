import type { Page } from '@playwright/test'

export const password = process.env.E2E_USER_PASSWORD ?? 'ShionlibE2E123!'

export const accounts = {
  member: 'e2e_user',
  owner: 'e2e_mutable_user',
  admin: 'e2e_admin',
} as const

export type Account = keyof typeof accounts

export const allAccounts: readonly Account[] = ['member', 'owner', 'admin']

export function sessionFile(account: Account): string {
  return `e2e/.sessions/${account}.json`
}

export async function signIn(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: '登录 Shionlib' })
  await dialog.getByLabel('用户名或邮箱').fill(name)
  await dialog.locator('input[type="password"]').fill(password)
  await dialog.getByRole('button', { name: '登录', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.waitForURL(url => !url.searchParams.has('auth'))
}

export async function openSignIn(page: Page, path = '/zh') {
  await page.goto(`${path}?auth=sign-in`)
  await page.waitForLoadState('networkidle')
}

import { expect, test } from '@playwright/test'
import { accounts, openSignIn, password, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

test('signs in from the dialog and signs out from the account menu', async ({ page }) => {
  await openSignIn(page)
  await signIn(page, 'e2e_relation_user')
  const account = page.getByRole('button', { name: /e2e_relation_user/ })
  await expect(account).toBeVisible()
  await account.click()
  await page.getByRole('menuitem', { name: '退出登录' }).click()
  await expect(page.getByRole('button', { name: '登录 / 注册' })).toBeVisible()
})

test('keeps the dialog open and explains a wrong password', async ({ page }) => {
  await openSignIn(page)
  const dialog = page.getByRole('dialog', { name: '登录 Shionlib' })
  await dialog.getByLabel('用户名或邮箱').fill(accounts.member)
  await dialog.locator('input[type="password"]').fill(`${password}-wrong`)
  await dialog.getByRole('button', { name: '登录', exact: true }).click()
  await expectNotice(page, '无效的密码')
  await expect(dialog).toBeVisible()
})

test('moves between the sign-in, sign-up and forgot-password views', async ({ page }) => {
  await openSignIn(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '注册' }).click()
  await expect(page.getByRole('dialog').getByLabel('邮箱')).toBeVisible()
  await page.goto('/zh?auth=forgot-password')
  await expect(page.getByRole('dialog').getByLabel('邮箱')).toBeVisible()
})

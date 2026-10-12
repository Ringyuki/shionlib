import { expect, test, type Page } from '@playwright/test'
import { openSignIn, sessionFile, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

const retention = '请求内容保留天数'

const weight = '浏览量权重'

function row(page: Page, label: string) {
  return page.getByRole('spinbutton', { name: label, exact: true })
}

test('shows the settings to an administrator without letting them change any', async ({ page }) => {
  await openSignIn(page, '/zh/admin/settings')
  await signIn(page, 'e2e_staff_user')
  await expect(page.getByRole('heading', { name: '设置', level: 1 })).toBeVisible()
  await expect(page.getByText('只有超级管理员可以修改设置')).toBeVisible()
  await expect(row(page, retention)).toBeDisabled()
  await expect(page.getByRole('switch', { name: '开放注册' })).toBeDisabled()
  await page.getByRole('button', { name: `${retention}的修改记录` }).click()
  await expect(page.getByRole('dialog', { name: '修改记录' })).toContainText('暂无修改记录')
})

test.describe('as a super administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('groups the settings and finds one by its name', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '设置' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/settings$/)
    const groups = page.getByRole('navigation', { name: '设置分组' })
    await expect(groups.getByRole('link', { name: /上传/ })).toBeVisible()
    await expect(groups.getByRole('link', { name: /限流/ })).toBeVisible()
    await expect(page.getByText('只有超级管理员可以修改设置')).toBeHidden()

    await page.getByRole('searchbox', { name: '搜索设置' }).fill('保留天数')
    await expect(row(page, retention)).toBeVisible()
    await expect(page.getByRole('heading', { name: '上传', level: 2 })).toHaveCount(0)
    await page.getByRole('searchbox', { name: '搜索设置' }).fill('no such setting')
    await expect(page.getByText('没有符合条件的设置')).toBeVisible()
  })

  test('keeps changes on the page until they are saved or given up', async ({ page }) => {
    await page.goto('/zh/admin/settings')
    await page.waitForLoadState('networkidle')
    await row(page, weight).fill('0.75')
    await row(page, weight).press('Tab')
    await expect(row(page, weight)).toHaveValue('0.75')
    await row(page, weight).fill('0.6')
    await row(page, weight).press('Tab')
    await expect(page.getByText(/项修改尚未保存/)).toHaveCount(0)
    await row(page, retention).fill('9')
    await row(page, retention).press('Tab')
    await expect(page.getByText('有 1 项修改尚未保存')).toBeVisible()
    await page.getByRole('switch', { name: '记录请求内容' }).click()
    await expect(page.getByText('有 2 项修改尚未保存')).toBeVisible()

    await row(page, retention).fill('0')
    await row(page, retention).press('Tab')
    await expect(page.getByText('不能小于 1')).toBeVisible()
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()

    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '概览' })
      .click()
    const leaving = page.getByRole('alertdialog')
    await expect(leaving).toContainText('要放弃尚未保存的修改吗？')
    await leaving.getByRole('button', { name: '继续修改' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/settings$/)

    await page.getByRole('button', { name: '放弃修改' }).click()
    await expect(page.getByText(/项修改尚未保存/)).toHaveCount(0)
    await expect(row(page, retention)).toHaveValue('7')
  })

  test('saves a setting, records the change and restores the default', async ({ page }) => {
    await page.goto('/zh/admin/settings')
    await page.waitForLoadState('networkidle')
    await row(page, retention).fill('9')
    await row(page, retention).press('Tab')
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expectNotice(page, '设置已保存')
    await expect(page.getByText(/项修改尚未保存/)).toHaveCount(0)

    await page.reload()
    await expect(row(page, retention)).toHaveValue('9')
    const setting = page.getByRole('group', { name: retention, exact: true })
    await expect(setting).toContainText('已修改')
    await expect(setting).toContainText('e2e_admin')

    await page.getByRole('button', { name: `${retention}的修改记录` }).click()
    const history = page.getByRole('dialog', { name: '修改记录' })
    await expect(history).toContainText('ai.payload_retention_days')
    await expect(history).toContainText('e2e_admin')
    await page.keyboard.press('Escape')
    await expect(history).toBeHidden()

    await setting.getByRole('button', { name: '恢复默认' }).click()
    await expect(row(page, retention)).toHaveValue('7')
    await expect(page.getByText('有 1 项修改尚未保存')).toBeVisible()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expectNotice(page, '设置已保存')
    await page.reload()
    await expect(row(page, retention)).toHaveValue('7')
    await expect(setting).not.toContainText('已修改')
  })
})

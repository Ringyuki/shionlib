import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const managed = 'e2e_managed_user'

async function openUser(page: Page, name: string) {
  await page.goto(`/zh/admin/users?q=${name}`)
  await page.getByRole('row', { name: new RegExp(`${name}@`) }).click()
  await expect(page).toHaveURL(/\/zh\/admin\/users\/\d+$/)
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })

  test('finds a user and narrows the list in the address', async ({ page }) => {
    await page.goto('/zh/admin')
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '用户' })
      .click()
    await expect(page).toHaveURL(/\/zh\/admin\/users$/)
    await expect(page.getByRole('heading', { name: '用户', level: 1 })).toBeVisible()
    const users = page.getByRole('table', { name: '用户' })
    await expect(users.getByRole('row', { name: /e2e_admin@/ })).toContainText('超级管理员')

    await page.getByRole('searchbox', { name: '搜索用户名、邮箱或编号' }).fill('e2e_managed')
    await expect(page).toHaveURL(/\/zh\/admin\/users\?q=e2e_managed$/)
    await expect(users.getByRole('row')).toHaveCount(2)
    await expect(users.getByRole('row', { name: new RegExp(managed) })).toContainText('正常')

    await page.getByRole('combobox', { name: '角色' }).click()
    await page.getByRole('option', { name: '管理员', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/users\?q=e2e_managed&role=2$/)
    await expect(page.getByText('没有符合条件的用户')).toBeVisible()
  })

  test('shows a user with what they uploaded and where they are signed in', async ({ page }) => {
    await openUser(page, 'e2e_mutable_user')
    await expect(page.getByText('e2e_mutable_user@shionlib.local')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: '邮箱' })).toHaveValue(
      'e2e_mutable_user@shionlib.local',
    )
    await expect(
      page.getByText(/新上传者，已发布 1 个资源，达到 \d+ 个时升为普通上传者/),
    ).toBeVisible()
    await expect(page.getByText(/直接授予可信档位：存储空间 .+，单个文件不限大小/)).toBeVisible()
    await expect(page.getByRole('link', { name: '1 个已发布的资源' })).toBeVisible()
    await expect(page.getByRole('table', { name: '登录会话' })).toBeVisible()
    await page.getByRole('link', { name: '用户', exact: true }).first().click()
    await expect(page).toHaveURL(/\/zh\/admin\/users$/)
  })

  test('keeps an administrator from acting on their own account', async ({ page }) => {
    await openUser(page, 'e2e_admin')
    await expect(page.getByRole('button', { name: '封禁' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '重置密码' })).toBeDisabled()
    await expect(page.getByRole('combobox', { name: '角色' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '保存' })).toBeEnabled()
  })

  test.describe('managing an account', () => {
    test.describe.configure({ mode: 'serial', retries: 0 })

    test('saves the profile', async ({ page }) => {
      await openUser(page, managed)
      await page.getByRole('combobox', { name: '界面语言' }).click()
      await page.getByRole('option', { name: '日本語' }).click()
      await page.getByRole('button', { name: '保存' }).click()
      await expectNotice(page, '账号资料已保存')
      await page.reload()
      await expect(page.getByRole('combobox', { name: '界面语言' })).toContainText('日本語')
    })

    test('grants and withdraws the trusted tier', async ({ page }) => {
      await openUser(page, managed)
      const trusted = page.getByRole('switch', { name: '可信上传者' })
      await expect(trusted).not.toBeChecked()
      await trusted.click()
      await expectNotice(page, '已授予可信上传者')
      await expect(page.getByText(/^可信上传者，已发布 0 个资源$/)).toBeVisible()
      await trusted.click()
      await expectNotice(page, '已收回可信上传者')
      await expect(page.getByText(/新上传者，已发布 0 个资源/)).toBeVisible()
    })

    test('bans with a reason and lifts the ban', async ({ page }) => {
      await openUser(page, managed)
      await page.getByRole('button', { name: '封禁' }).click()
      const dialog = page.getByRole('dialog', { name: `封禁 ${managed}` })
      await dialog.getByRole('button', { name: '封禁' }).click()
      await expect(dialog.getByText('请填写封禁原因')).toBeVisible()
      await dialog.getByRole('button', { name: '自定' }).click()
      await expect(dialog.getByRole('spinbutton', { name: '天数' })).toBeVisible()
      await dialog.getByRole('button', { name: '3 天' }).click()
      await expect(dialog.getByRole('spinbutton', { name: '天数' })).toHaveCount(0)
      await dialog.getByRole('textbox', { name: '原因' }).fill('Banned by E2E')
      await dialog.getByRole('button', { name: '封禁' }).click()
      await expectNotice(page, `已封禁 ${managed}`)
      await expect(dialog).toBeHidden()
      await expect(page.getByText(/已封禁，将于 .+ 解除/)).toBeVisible()
      await expect(page.getByText(/e2e_admin 于 .+ 封禁 3 天，原因：Banned by E2E/)).toBeVisible()
      await expect(page.getByRole('button', { name: '封禁', exact: true })).toHaveCount(0)

      await page.goto('/zh/admin/users?status=2')
      await expect(page.getByRole('row', { name: new RegExp(managed) })).toContainText('已封禁')

      await openUser(page, managed)
      await page.getByRole('button', { name: '解除封禁' }).click()
      const confirm = page.getByRole('alertdialog')
      await expect(confirm).toContainText(`确定要解除对 ${managed} 的封禁吗？`)
      await confirm.getByRole('button', { name: '解除封禁' }).click()
      await expectNotice(page, `已解除对 ${managed} 的封禁`)
      await expect(page.getByText(/已封禁，将于/)).toBeHidden()
      await expect(page.getByRole('button', { name: '封禁', exact: true })).toBeEnabled()
    })

    test('sets and withdraws the sponsor badge', async ({ page }) => {
      await openUser(page, managed)
      await expect(page.getByText('没有赞助徽章')).toBeVisible()
      await page.getByRole('button', { name: '设置', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '设置赞助徽章' })
      await dialog.getByRole('spinbutton').first().click()
      await page.keyboard.type('20270115')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expectNotice(page, '赞助徽章已保存')
      await expect(dialog).toBeHidden()
      await expect(page.getByText('2027年1月15日')).toBeVisible()

      await page.getByRole('button', { name: '设置', exact: true }).click()
      await dialog.getByRole('button', { name: '清除' }).click()
      await dialog.getByRole('button', { name: '保存' }).click()
      await expectNotice(page, '赞助徽章已收回')
      await expect(page.getByText('没有赞助徽章')).toBeVisible()
    })

    test('resets the password', async ({ page }) => {
      await openUser(page, managed)
      await page.getByRole('button', { name: '重置密码' }).click()
      const dialog = page.getByRole('dialog', { name: '重置密码' })
      await dialog.getByLabel('新密码').fill('short')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expect(dialog).toBeVisible()
      await dialog.getByLabel('新密码').fill('ManagedE2E456!')
      await dialog.getByRole('button', { name: '保存' }).click()
      await expectNotice(page, '密码已重置')
      await expect(dialog).toBeHidden()
    })

    test('changes the role after asking', async ({ page }) => {
      await openUser(page, managed)
      const role = page.getByRole('combobox', { name: '角色' })
      await role.click()
      await page.getByRole('option', { name: '管理员', exact: true }).click()
      const confirm = page.getByRole('alertdialog')
      await expect(confirm).toContainText(`确定要把 ${managed} 的角色改为管理员吗？`)
      await confirm.getByRole('button', { name: '取消' }).click()
      await expect(role).toContainText('用户')
      await role.click()
      await page.getByRole('option', { name: '管理员', exact: true }).click()
      await confirm.getByRole('button', { name: '更改' }).click()
      await expectNotice(page, '角色已更改')
      await expect(role).toContainText('管理员')
      await role.click()
      await page.getByRole('option', { name: '用户', exact: true }).click()
      await confirm.getByRole('button', { name: '更改' }).click()
      await expect(role).toContainText('用户')
    })
  })
})

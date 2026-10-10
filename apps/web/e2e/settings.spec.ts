import { expect, test, type Page } from '@playwright/test'
import { openSignIn, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

const account = 'e2e_relation_user'

async function openSettings(page: Page, section: string) {
  await openSignIn(page, `/zh/user/settings/${section}`)
  await signIn(page, account)
}

test('asks a guest to sign in before any setting', async ({ page }) => {
  await page.goto('/zh/user/settings')
  await expect(page).toHaveURL(/\/zh\/user\/settings\/personal$/)
  await expect(page.getByText('登录后可以修改账号设置')).toBeVisible()
  await page.goto('/zh/user/settings/security')
  await expect(page.getByText('登录后可以修改账号设置')).toBeVisible()
})

test('saves each site preference on its own', async ({ page }) => {
  await openSettings(page, 'site')
  const limits = page.getByRole('radiogroup', { name: '成人内容' })
  await limits.getByRole('radio', { name: /^显示/ }).click()
  await expect(limits.getByRole('radio', { name: /^显示/ })).toBeChecked()
  const onlyWithResources = page.getByRole('switch', { name: /仅显示有资源的游戏/ })
  await expect(onlyWithResources).toBeChecked()
  await onlyWithResources.click()
  await expect(onlyWithResources).not.toBeChecked()
  await page.getByText('深色', { exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(
    page.getByRole('radiogroup', { name: '成人内容' }).getByRole('radio', { name: /^显示/ }),
  ).toBeChecked()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('switch', { name: /仅显示有资源的游戏/ })).not.toBeChecked()

  await page.goto('/zh/game')
  await expect(
    page
      .getByRole('complementary', { name: '筛选' })
      .getByRole('switch', { name: '仅显示有资源的游戏' }),
  ).not.toBeChecked()
})

test('changes the language of the site and remembers it', async ({ page }) => {
  await openSettings(page, 'site')
  await page.getByRole('combobox', { name: '界面语言' }).click()
  await page.getByRole('option', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/user\/settings\/site$/)
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await page.goto('/')
  await expect(page).toHaveURL(/\/en$/)
})

test('keeps download settings in the browser as they are changed', async ({ page }) => {
  await openSettings(page, 'download')
  await page.getByRole('radio', { name: /^推送到 aria2/ }).click()
  const endpoint = page.getByLabel('RPC 地址')
  await endpoint.fill('nas:6800')
  await expect(page.getByText('请输入完整的地址')).toBeVisible()
  await endpoint.fill('http://127.0.0.1:6899/jsonrpc')
  await expect(page.getByText('请输入完整的地址')).toHaveCount(0)
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('alert')).toContainText('无法连接 aria2')
  await page.reload()
  await expect(page.getByRole('radio', { name: /^推送到 aria2/ })).toBeChecked()
  await expect(page.getByLabel('RPC 地址')).toHaveValue('http://127.0.0.1:6899/jsonrpc')
})

test('offers a game manager as the default only while it is shown', async ({ page }) => {
  await openSettings(page, 'download')
  await page.getByRole('radio', { name: /^推送到 LunaBox/ }).click()
  await page.getByRole('switch', { name: '在下载菜单中显示 LunaBox' }).click()
  await expect(page.getByRole('radio', { name: /^推送到 LunaBox/ })).toHaveCount(0)
  await expect(page.getByRole('radio', { name: /^浏览器下载/ })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('switch', { name: '在下载菜单中显示 LunaBox' })).not.toBeChecked()
  await expect(page.getByRole('radio', { name: /^推送到 ReinaManager/ })).toBeVisible()
})

test('checks a user name while it is typed and saves the bio', async ({ page }) => {
  await openSettings(page, 'personal')
  const name = page.getByRole('textbox', { name: '用户名' })
  await name.fill('e2e_admin')
  await expect(page.getByText('该用户名已被使用')).toBeVisible()
  await name.fill(`e2e_free_${Date.now() % 100000}`)
  await expect(page.getByText('该用户名可以使用')).toBeVisible()
  await name.fill(account)

  const bio = `E2E 简介 ${Date.now()}`
  await page.getByRole('textbox', { name: '简介' }).fill(bio)
  await page.getByRole('button', { name: '保存' }).nth(1).click()
  await expectNotice(page, '简介已保存')
  await page.getByRole('link', { name: '收藏', exact: true }).click()
  await expect(page.getByText(bio)).toBeVisible()
})

test('guards the password and manages passkeys', async ({ page, context }) => {
  await openSettings(page, 'security')
  await page.getByRole('button', { name: '修改' }).nth(1).click()
  const password = page.getByRole('dialog', { name: '修改密码' })
  await password.getByLabel('当前密码').fill('not-the-password')
  await password.locator('input[autocomplete="new-password"]').first().fill('ShionlibE2E123!x')
  await password.getByLabel('再次输入新密码').fill('different')
  await password.getByRole('button', { name: '确认修改' }).click()
  await expect(password.getByText('两次输入的密码不一致')).toBeVisible()
  await password.getByLabel('再次输入新密码').fill('ShionlibE2E123!x')
  await password.getByRole('button', { name: '确认修改' }).click()
  await expect(password).toBeVisible()
  await password.getByRole('button', { name: '取消' }).click()
  await expect(password).toBeHidden()

  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  const name = `E2E 设备 ${Date.now() % 100000}`
  await page.getByRole('button', { name: '添加通行密钥' }).click()
  const passkey = page.getByRole('dialog', { name: '添加通行密钥' })
  await passkey.getByLabel('名称').fill(name)
  await passkey.getByRole('button', { name: '继续' }).click()
  await expectNotice(page, '通行密钥已添加')
  const passkeys = page.getByRole('list', { name: '通行密钥' })
  await expect(passkeys.getByText(name)).toBeVisible()
  await passkeys.getByRole('button', { name: `删除「${name}」` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
  await expectNotice(page, '通行密钥已删除')
  await expect(passkeys.getByText(name)).toHaveCount(0)
})

test('offers to link accounts and says why linking failed', async ({ page }) => {
  await openSettings(page, 'connections')
  await expect(page.getByRole('heading', { name: 'Hikarinagi ID' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'PotatoVN' })).toBeVisible()
  await page.goto('/zh/user/settings/connections?oidc_error=link_conflict')
  await expectNotice(page, '这个 Hikarinagi ID 已关联到其他账号')
  await expect(page).toHaveURL(/\/zh\/user\/settings\/connections$/)
})

test('lets the area of an avatar be chosen before it is uploaded', async ({ page }) => {
  const onePixel =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const picture = {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(onePixel, 'base64'),
  }
  let uploads = 0
  await page.route('**/resources/settings/avatar.data', route => {
    uploads += 1
    return route.fulfill({
      status: 200,
      contentType: 'text/x-script',
      body: '[{"_1":2},"data",{"_3":4,"_5":6},"ok",true,"result",{}]',
    })
  })
  await openSettings(page, 'personal')
  const choose = async () => {
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '更换头像' }).click()
    await (await chooser).setFiles(picture)
  }

  await choose()
  const dialog = page.getByRole('dialog', { name: '裁剪头像' })
  const confirm = dialog.getByRole('button', { name: '确认' })
  await expect(dialog.locator('.advanced-cropper-circle-stencil')).toBeVisible()
  await expect(confirm).toBeEnabled()
  await expect(dialog.getByRole('button', { name: '重置' })).toBeEnabled()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  expect(uploads).toBe(0)

  await choose()
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expectNotice(page, '图片已更新')
  await expect(dialog).toBeHidden()
  expect(uploads).toBe(1)
})

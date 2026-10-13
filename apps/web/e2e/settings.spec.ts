import { expect, test, type Page } from '@playwright/test'
import { openSignIn, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

const account = 'e2e_relation_user'

const untouched = 'e2e_permission_user'

async function openSettings(page: Page, section: string, name = account) {
  await openSignIn(page, `/zh/user/settings/${section}`)
  await signIn(page, name)
}

test('asks a guest to sign in before any setting', async ({ page }) => {
  await page.goto('/zh/user/settings')
  await expect(page).toHaveURL(/\/zh\/user\/settings\/personal$/)
  await expect(page.getByText('登录后可以修改账号设置')).toBeVisible()
  await page.goto('/zh/user/settings/security')
  await expect(page.getByText('登录后可以修改账号设置')).toBeVisible()
})

async function saved(page: Page, change: () => Promise<void>) {
  const answered = page.waitForResponse(
    response => response.url().includes('/resources/viewer/preferences') && response.ok(),
  )
  await change()
  await answered
}

test('saves each site preference on its own', async ({ page }) => {
  await openSettings(page, 'site')
  const limits = page.getByRole('radiogroup', { name: '成人内容' })
  await saved(page, () => limits.getByRole('radio', { name: /^显示/ }).click())
  await expect(limits.getByRole('radio', { name: /^显示/ })).toBeChecked()
  const onlyWithResources = page.getByRole('switch', { name: /仅显示有资源的游戏/ })
  await expect(onlyWithResources).toBeChecked()
  await saved(page, () => onlyWithResources.click())
  await expect(onlyWithResources).not.toBeChecked()
  const backgrounds = page.getByRole('switch', { name: /显示其他用户的页面背景/ })
  await expect(backgrounds).toBeChecked()
  await saved(page, () => backgrounds.click())
  await expect(backgrounds).not.toBeChecked()
  await page.getByText('深色', { exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(
    page.getByRole('radiogroup', { name: '成人内容' }).getByRole('radio', { name: /^显示/ }),
  ).toBeChecked()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('switch', { name: /仅显示有资源的游戏/ })).not.toBeChecked()
  await expect(page.getByRole('switch', { name: /显示其他用户的页面背景/ })).not.toBeChecked()

  await page.goto('/zh/game')
  await expect(
    page
      .getByRole('complementary', { name: '筛选' })
      .getByRole('switch', { name: '仅显示有资源的游戏' }),
  ).not.toBeChecked()

  let asked = 0
  await page.route('**/user/e2e/background/**', route => {
    asked += 1
    return route.abort()
  })
  await page.goto('/zh/user/3')
  await expect(page.getByRole('article', { name: 'e2e_mutable_user' })).toHaveCSS(
    'backdrop-filter',
    'none',
  )
  expect(asked).toBe(0)
})

test('applies the adult content setting at once, in the session that changed it', async ({
  page,
}) => {
  await openSettings(page, 'site', untouched)
  const screenshots = page.getByRole('region', { name: '截图' })
  const masks = screenshots.getByRole('button', { name: '成人内容，点击显示' })
  const choose = async (label: RegExp) => {
    await page.goto('/zh/user/settings/site')
    const choice = page
      .getByRole('radiogroup', { name: '成人内容' })
      .getByRole('radio', { name: label })
    await saved(page, () =>
      expect(async () => {
        await choice.click()
        await expect(choice).toBeChecked({ timeout: 1000 })
      }).toPass(),
    )
    await page.goto('/zh/game/1/info')
  }
  await choose(/^隐藏/)
  await expect(screenshots.getByRole('button')).toHaveCount(9)
  await choose(/^遮罩/)
  await expect(screenshots.getByRole('button')).toHaveCount(10)
  await expect(masks).toHaveCount(1)
  await choose(/^显示/)
  await expect(screenshots.getByRole('button')).toHaveCount(10)
  await expect(masks).toHaveCount(0)
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

test('checks a user name while it is typed and leads to the profile for the rest', async ({
  page,
}) => {
  await openSettings(page, 'personal')
  const name = page.getByRole('textbox', { name: '用户名' })
  await name.fill('e2e_admin')
  await expect(page.getByText('该用户名已被使用')).toBeVisible()
  await name.fill(`e2e_free_${Date.now() % 100000}`)
  await expect(page.getByText('该用户名可以使用')).toBeVisible()
  await name.fill(account)

  await expect(page.getByRole('textbox', { name: '简介' })).toHaveCount(0)
  await page.getByRole('link', { name: '前往个人主页' }).click()
  await expect(page).toHaveURL(/\/zh\/user\/\d+$/)
  await expect(page.getByRole('heading', { name: account, level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: '编辑资料' })).toBeVisible()
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

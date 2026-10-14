import { expect, test } from '@playwright/test'

test('finds a translator by alias and lists the games it is credited in', async ({ page }) => {
  await page.goto('/zh')
  await page.getByRole('link', { name: '汉化组', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/translator$/)
  await expect(page).toHaveTitle('汉化组 - Shionlib')
  const list = page.getByRole('list', { name: '汉化组' })
  await expect(list.getByRole('link', { name: /绿茶汉化组/ })).toBeVisible()

  await page.getByRole('searchbox', { name: '搜索汉化组名称或别名' }).fill('green tea')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/zh\/translator\?q=green\+tea$/)
  await expect(page.getByText('找到 1 个相符的汉化组')).toBeVisible()
  await expect(list.getByRole('link')).toHaveCount(1)

  await list.getByRole('link', { name: /绿茶汉化组/ }).click()
  await expect(page).toHaveURL(/\/zh\/translator\/1$/)
  await expect(page).toHaveTitle('绿茶汉化组 - Shionlib')
  await expect(page.getByRole('heading', { name: '绿茶汉化组', level: 1 })).toBeVisible()
  await expect(page.getByText('Green Tea')).toBeVisible()
  await expect(page.getByRole('link', { name: '主页' })).toHaveAttribute(
    'href',
    'https://example.org/green-tea',
  )
  await expect(page.getByRole('heading', { name: /^作品（\d+）$/ })).toBeVisible()
  await expect(
    page.getByRole('list', { name: '作品' }).getByRole('link', { name: /常轨脱离Creative/ }),
  ).toHaveAttribute('href', '/zh/game/1')
})

test('opens a translator from the resource that credits it', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.locator('#resource-1').getByRole('link', { name: '绿茶汉化组' }).click()
  await expect(page).toHaveURL(/\/zh\/translator\/1$/)
})

test('leaves out the translators nobody has credited yet', async ({ page }) => {
  await page.goto('/zh/translator?q=Can%2Fneed')
  await expect(page.getByText('没有找到与「Can/need」相符的汉化组')).toBeVisible()

  await page.goto('/zh/translator?page=9')
  await expect(page).toHaveURL(/\/zh\/translator$/)
})

test('answers 404 for a translator that does not exist', async ({ page }) => {
  const response = await page.goto('/zh/translator/999999')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('main').getByText('状态码 404')).toBeVisible()
})

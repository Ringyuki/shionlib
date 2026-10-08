import { expect, test } from '@playwright/test'

test('finds a developer by alias and lists its works', async ({ page }) => {
  await page.goto('/zh')
  await page.getByRole('link', { name: '开发商', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/developer$/)
  const list = page.getByRole('list', { name: '开发商' })
  await expect(list.getByRole('link')).toHaveCount(3)

  await page.getByRole('searchbox', { name: '搜索开发商名称或别名' }).fill('窗社')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/zh\/developer\?q=%E7%AA%97%E7%A4%BE$/)
  await expect(page.getByText('找到 1 个相符的开发商')).toBeVisible()
  await expect(list.getByRole('link')).toHaveCount(1)

  await list.getByRole('link', { name: /まどそふと/ }).click()
  await expect(page).toHaveURL(/\/zh\/developer\/1$/)
  await expect(page).toHaveTitle('まどそふと | Shionlib')
  await expect(page.getByRole('heading', { name: 'まどそふと', level: 1 })).toBeVisible()
  await expect(page.getByText('引用来源')).toBeVisible()
  await expect(page.getByRole('heading', { name: '作品（1）' })).toBeVisible()
  await expect(
    page.getByRole('list', { name: '作品' }).getByRole('link', { name: /常轨脱离Creative/ }),
  ).toHaveAttribute('href', '/zh/game/1')
})

test('keeps the chosen order of the works in the address', async ({ page }) => {
  await page.goto('/zh/developer/1?sort=downloads')
  await expect(page.getByRole('heading', { name: '作品（1）' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '排序方式' })).toHaveCount(0)

  await page.goto('/zh/game?sort=downloads')
  await expect(page.getByRole('combobox', { name: '排序方式' })).toHaveText('下载最多')
})

test('says when no developer matches and keeps to the pages that exist', async ({ page }) => {
  await page.goto('/zh/developer?q=no-such-developer')
  await expect(page.getByText('没有找到与「no-such-developer」相符的开发商。')).toBeVisible()

  await page.goto('/zh/developer?page=9')
  await expect(page).toHaveURL(/\/zh\/developer$/)
  await expect(page.getByRole('list', { name: '开发商' }).getByRole('link')).toHaveCount(3)
})

test('opens the developer of a game from its page', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.getByRole('main').getByRole('link', { name: 'まどそふと' }).first().click()
  await expect(page).toHaveURL(/\/zh\/developer\/1$/)
})

test('answers 404 for a developer that does not exist', async ({ page }) => {
  const response = await page.goto('/zh/developer/999999')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('main').getByText('状态码 404')).toBeVisible()
})

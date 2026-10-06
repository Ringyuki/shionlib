import { expect, test } from '@playwright/test'

test('opens on the resources tab with the seeded files', async ({ page }) => {
  await page.goto('/zh/game/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('常轨脱离Creative Re:Re:call')
  await expect(page.getByRole('tab', { name: /资源/ })).toHaveAttribute('aria-selected', 'true')
  const card = page.locator('#resource-1')
  await expect(card.getByText('seeded-reportable-sample.zip')).toBeVisible()
  await expect(card.getByText('Windows')).toBeVisible()
})

test('switches tabs through the URL', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.getByRole('tab', { name: /简介/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/info$/)
  await expect(page.getByRole('region', { name: '简介' })).toBeVisible()
  await page.getByRole('tab', { name: /角色/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/1\/characters$/)
})

test('links catalog tags to the game library', async ({ page }) => {
  await page.goto('/zh/game/1/info')
  const tags = page.getByRole('heading', { name: '标签' }).locator('..')
  const tag = tags.getByRole('link').first()
  await expect(tag).toHaveAttribute('href', /^\/zh\/game\?tag=/)
})

test('blocks the download of a file held for review', async ({ page }) => {
  await page.goto('/zh/game/3')
  const row = page.getByRole('row', { name: /seeded-malware-sample\.zip/ })
  await expect(row.getByRole('button', { name: '下载', exact: true })).toBeDisabled()
})

test('renders the page in the visitor language', async ({ page }) => {
  await page.goto('/en/game/1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('HAMIDASHI CREATIVE Re:Re:call')
})

test('answers an unknown game with the not-found page', async ({ page }) => {
  const response = await page.goto('/zh/game/999999')
  expect(response?.status()).toBe(404)
  await expect(page.getByText('页面不存在')).toBeVisible()
})

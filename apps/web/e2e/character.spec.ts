import { expect, test } from '@playwright/test'

test('opens a character from the cast of a game and lists where it appears', async ({ page }) => {
  await page.goto('/zh/game/1/characters')
  await page.getByRole('link', { name: /和泉妃爱/ }).click()
  await expect(page).toHaveURL(/\/zh\/character\/1$/)
  await expect(page).toHaveTitle('和泉妃爱（和泉妃愛） - 常轨脱离Creative Re:Re:call - Shionlib')
  await expect(page.getByRole('heading', { name: '和泉妃爱', level: 1 })).toBeVisible()
  const header = page.getByRole('main').locator('header')
  await expect(header.getByText('和泉妃愛', { exact: true })).toBeVisible()
  await expect(header.getByText('Izumi Hiyori', { exact: true })).toBeVisible()

  const facts = header.getByRole('definition')
  await expect(facts.filter({ hasText: /^女$/ })).toHaveCount(1)
  await expect(facts.filter({ hasText: '9月5日' })).toBeVisible()
  await expect(facts.filter({ hasText: '40 kg' })).toBeVisible()
  await expect(header.getByRole('term').filter({ hasText: '身高' })).toHaveCount(0)

  await expect(page.getByRole('heading', { name: '登场作品（1）' })).toBeVisible()
  const appearance = page
    .getByRole('list', { name: '登场作品' })
    .getByRole('link', { name: /常轨脱离Creative/ })
  await expect(appearance).toHaveAttribute('href', '/zh/game/1')
  await expect(appearance.getByText('配角', { exact: true })).toBeVisible()
})

test('names a character in the language of the page', async ({ page }) => {
  await page.goto('/en/character/1')
  await expect(page.getByRole('heading', { name: 'Izumi Hiyori', level: 1 })).toBeVisible()
  await expect(page.getByText('September 5')).toBeVisible()
})

test('answers 404 for a character that does not exist', async ({ page }) => {
  const response = await page.goto('/zh/character/999999')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('main').getByText('状态码 404')).toBeVisible()
})

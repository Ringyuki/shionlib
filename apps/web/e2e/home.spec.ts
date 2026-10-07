import { expect, test, type Page } from '@playwright/test'

const seededGame = '常轨脱离Creative Re:Re:call'

function block(page: Page, heading: string | RegExp) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: heading }) })
}

test('leads from a recently updated game to its page', async ({ page }) => {
  await page.goto('/zh')
  await expect(block(page, '最近更新的资源').getByRole('link', { name: '更多' })).toHaveAttribute(
    'href',
    '/zh/game?sort=resource_updated',
  )
  const card = block(page, '最近更新的资源').getByRole('link', { name: seededGame })
  await expect(card).toContainText('个资源')
  await card.click()
  await expect(page).toHaveURL(/\/zh\/game\/1$/)
})

test('lists the hot games and says when the month has no releases', async ({ page }) => {
  await page.goto('/zh')
  await expect(block(page, '热门游戏').getByRole('link', { name: seededGame })).toBeVisible()
  await expect(block(page, /月新作$/).getByText('本月暂未收录新作')).toBeVisible()
})

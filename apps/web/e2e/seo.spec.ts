import { expect, test } from '@playwright/test'

test('serves robots.txt and the sitemap at the root of the site', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const rules = await robots.text()
  expect(rules).toContain('Disallow: /api/')
  expect(rules).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml\n$/)
  const index = await request.get('/sitemap.xml')
  expect(index.headers()['content-type']).toContain('application/xml')
  expect(await index.text()).toContain('/sitemap.xml?section=pages</loc>')
  const games = await request.get('/sitemap.xml?section=game&page=1')
  expect(await games.text()).toContain('/zh/game/1</loc>')
  expect((await request.get('/sitemap.xml?section=game&page=999')).status()).toBe(404)
})

test('offers only the Chinese pages to search engines', async ({ page }) => {
  await page.goto('/zh/game/1')
  await expect(page).toHaveTitle(/^常轨脱离Creative Re:Re:call.* - Shionlib$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/zh\/game\/1$/)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/game\/1\?locale=zh$/,
  )
  await page.goto('/en/game/1')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
})

test('moves old and slashed addresses for good', async ({ request }) => {
  const old = await request.get('/game/1', { maxRedirects: 0 })
  expect(old.status()).toBe(301)
  expect(old.headers().location).toBe('/zh/game/1')
  const slashed = await request.get('/zh/game/1/', { maxRedirects: 0 })
  expect(slashed.status()).toBe(301)
  expect(slashed.headers().location).toBe('/zh/game/1')
})

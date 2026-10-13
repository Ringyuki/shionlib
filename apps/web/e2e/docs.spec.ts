import { expect, type Page } from '@playwright/test'
import { test } from './support/ingress'

function title(page: Page) {
  return page.getByRole('heading', { level: 1 }).first()
}

function contents(page: Page) {
  return page.getByRole('navigation', { name: '本页目录' })
}

test('lists the documents in the order they are read and opens one from its row', async ({
  page,
}) => {
  await page.goto('/zh')
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '文档' }).click()
  await expect(page).toHaveURL(/\/zh\/docs$/)
  await expect(page).toHaveTitle('文档 | Shionlib')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['指南', '关于', '开发'])
  const guides = page.getByRole('region', { name: '指南' }).getByRole('link')
  await expect(guides).toHaveCount(12)
  await expect(guides.nth(0)).toContainText('如何下载游戏')
  await expect(guides.nth(1)).toContainText('文件解压指南')
  await expect(guides.nth(11)).toContainText('设置编辑指南')
  await expect(page.locator('section a')).toHaveCount(14)

  await guides.nth(0).click()
  await expect(page).toHaveURL(/\/zh\/docs\/guides\/download-games$/)
  await expect(title(page)).toHaveText('如何下载游戏')
  await expect(page).toHaveTitle('如何下载游戏 | Shionlib')
  await expect(page.getByRole('article').getByRole('link', { name: 'ringyuki' })).toHaveAttribute(
    'href',
    '/zh/user/1',
  )
  await expect(page.getByRole('link', { name: '在 GitHub 上编辑此页' })).toHaveAttribute(
    'href',
    /apps\/web\/app\/features\/docs\/content\/zh\/guides\/download-games\.mdx$/,
  )
  await page.getByRole('main').getByRole('link', { name: '文档', exact: true }).click()
  await expect(page).toHaveURL(/\/zh\/docs$/)
  await expect(title(page)).toHaveText('文档')
})

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('goes to a section from the table of contents beside the document', async ({ page }) => {
    await page.goto('/zh/docs/guides/download-games')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '本页目录' })).toBeHidden()
    await contents(page).getByRole('link', { name: '校验文件哈希' }).click()
    await expect(page).toHaveURL(/#%E6%A0%A1%E9%AA%8C%E6%96%87%E4%BB%B6%E5%93%88%E5%B8%8C$/)
    await expect(page.getByRole('heading', { name: '校验文件哈希' })).toBeInViewport()
  })

  test('opens at the heading its address names, in any language', async ({ page }) => {
    await page.goto(`/zh/docs/guides/download-games#${encodeURIComponent('校验文件哈希')}`)
    await expect(page.getByRole('heading', { name: '校验文件哈希' })).toBeInViewport()
    await page.goto('/en/docs/guides/lunabox')
    await expect(title(page)).toHaveText('Downloading with LunaBox')
    await page.goto('/ja/docs/about/about-shionlib')
    await expect(page.getByRole('article')).toContainText('Shionlib')
  })
})

test('follows a link from one document to another and walks to its neighbours', async ({
  page,
}) => {
  await page.goto('/zh/docs/guides/download-games')
  await page.waitForLoadState('networkidle')
  await page.getByRole('article').getByRole('link', { name: '常见引擎与模拟器对照' }).click()
  await expect(page).toHaveURL(/\/zh\/docs\/guides\/common-vn-engines-and-emulators$/)
  await expect(title(page)).toHaveText('常见引擎与模拟器对照')
  const walk = page.getByRole('article').locator('a[rel="prev"], a[rel="next"]')
  await expect(walk).toHaveCount(2)
  const next = page.getByRole('article').locator('a[rel="next"]')
  const target = (await next.getAttribute('href')) ?? ''
  await next.click()
  await expect(page).toHaveURL(new RegExp(`${target}$`))
  await expect(page).toHaveURL(/\/zh\/docs\/guides\/lunabox$/)
  await expect(page.getByRole('article').locator('a[rel="prev"]')).toHaveAttribute(
    'href',
    '/zh/docs/guides/common-vn-engines-and-emulators',
  )
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('keeps the table of contents folded above the document', async ({ page }) => {
    await page.goto('/zh/docs/guides/download-games')
    await page.waitForLoadState('networkidle')
    await expect(contents(page)).toBeHidden()
    await page.getByRole('button', { name: '本页目录' }).click()
    await contents(page).getByRole('link', { name: '校验文件哈希' }).click()
    await expect(page.getByRole('heading', { name: '校验文件哈希' })).toBeInViewport()
  })
})

test('leads from the address of a document that was taken down to the list of documents', async ({
  page,
  request,
}) => {
  const answer = await request.get('/ja/docs/guides/edit-history-and-undo', { maxRedirects: 0 })
  expect(answer.status()).toBe(301)
  expect(answer.headers().location).toBe('/ja/docs')
  await page.goto('/zh/docs/guides/edit-info')
  await expect(page).toHaveURL(/\/zh\/docs$/)
  await expect(title(page)).toHaveText('文档')
})

test('answers an address no document has with the not found page', async ({ page }) => {
  const missing = await page.goto('/zh/docs/guides/never-written')
  expect(missing?.status()).toBe(404)
  await expect(page.getByText('页面不存在')).toBeVisible()
  const elsewhere = await page.goto('/zh/docs/faq/download-games')
  expect(elsewhere?.status()).toBe(404)
})

test('lists the friend sites on a page of their own', async ({ page }) => {
  await page.goto('/zh')
  await page.getByLabel('站点信息').getByRole('link', { name: '友情链接' }).click()
  await expect(page).toHaveURL(/\/zh\/friend-link$/)
  await expect(title(page)).toHaveText('友情链接')
  await expect(page).toHaveTitle('友情链接 | Shionlib')
  const sites = page.getByRole('main').getByRole('listitem')
  await expect(sites).toHaveCount(7)
  const first = sites.first().getByRole('link')
  await expect(first).toHaveAttribute('href', 'https://www.kungal.com')
  await expect(first).toHaveAttribute('target', '_blank')
})

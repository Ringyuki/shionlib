import { expect, test, type Page } from '@playwright/test'
import { recognized, refused } from './support/image-search'
import { expectNotice } from './support/notices'

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function answerPictures(page: Page, status: number, body: string) {
  await page.route('**/resources/search/image.data', route =>
    route.fulfill({
      status,
      contentType: 'text/x-script',
      headers: { 'x-remix-response': 'yes' },
      body,
    }),
  )
}

async function openPalette(page: Page) {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('/')
  return page.getByRole('dialog', { name: '搜索' })
}

test('searches the typed words with the search button', async ({ page }) => {
  const palette = await openPalette(page)
  const submit = palette.getByRole('button', { name: '搜索', exact: true })
  await expect(submit).toBeDisabled()
  await palette.getByRole('searchbox').fill('e2e button term')
  await submit.click()
  await expect(page).toHaveURL(/\/zh\/search\?q=e2e\+button\+term$/)
  await expect(palette).toBeHidden()
})

test('switches between words and a picture', async ({ page }) => {
  const palette = await openPalette(page)
  const toggle = palette.getByRole('button', { name: '以图搜索' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(palette.getByRole('button', { name: '选择图片' })).toBeVisible()
  await expect(palette.getByText('JPG、PNG、WebP 或 GIF')).toBeVisible()
  await palette.getByRole('searchbox').fill('e2e')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(palette.getByRole('button', { name: '选择图片' })).toHaveCount(0)
  await toggle.click()
  await toggle.click()
  await expect(palette.getByRole('button', { name: '选择图片' })).toHaveCount(0)
})

test('turns away a file that is not a picture', async ({ page }) => {
  const palette = await openPalette(page)
  await palette.getByRole('button', { name: '以图搜索' }).click()
  await palette
    .locator('input[type=file]')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('words') })
  await expectNotice(page, '不支持该图片格式')
  await expect(palette.getByRole('button', { name: '选择图片' })).toBeVisible()
})

test('lists the games and characters a picture shows', async ({ page }) => {
  await answerPictures(page, 200, recognized)
  const palette = await openPalette(page)
  await palette.getByRole('button', { name: '以图搜索' }).click()
  await palette
    .locator('input[type=file]')
    .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: pixel })
  await expect(palette.getByText('识别到 2 个角色')).toBeVisible()
  await expect(palette.getByRole('link', { name: 'AnimeTrace' }).first()).toHaveAttribute(
    'href',
    'https://www.animetrace.com/',
  )
  await expect(palette.getByRole('listbox', { name: '识图结果' }).getByRole('option')).toHaveText([
    /千恋＊万花/,
    /蕾娜·莉希特娜瓦/,
    /朝武\s+安晴/,
  ])
  await palette.getByRole('button', { name: '换一张' }).click()
  await expect(palette.getByRole('button', { name: '选择图片' })).toBeVisible()
})

test('recognizes a picture pasted into the palette', async ({ page }) => {
  await answerPictures(page, 200, recognized)
  const palette = await openPalette(page)
  await palette.getByRole('searchbox').evaluate((input, base64) => {
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0))
    const data = new DataTransfer()
    data.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }))
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  }, pixel.toString('base64'))
  await expect(palette.getByRole('button', { name: '以图搜索' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(palette.getByText('识别到 2 个角色')).toBeVisible()
})

test('goes back to choosing when a picture is refused', async ({ page }) => {
  await answerPictures(page, 415, refused)
  const palette = await openPalette(page)
  await palette.getByRole('button', { name: '以图搜索' }).click()
  await palette
    .locator('input[type=file]')
    .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: pixel })
  await expectNotice(page, '不支持该图片格式，请使用 JPG、PNG、WebP 或 GIF')
  await expect(palette.getByRole('button', { name: '选择图片' })).toBeVisible()
})

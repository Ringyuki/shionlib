import { expect, test } from '@playwright/test'

test('opens the search palette with the slash key', async ({ page }) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('/')
  await expect(page.getByRole('dialog').getByPlaceholder('搜索游戏、开发商、角色')).toBeFocused()
})

test('keeps what the palette shows while it closes and starts empty the next time', async ({
  page,
}) => {
  await page.goto('/zh')
  await page.waitForLoadState('networkidle')
  const opener = page.getByRole('banner').getByRole('button', { name: /搜索游戏、开发商、角色/ })
  await opener.click()
  const palette = page.getByRole('dialog')
  const input = palette.getByPlaceholder('搜索游戏、开发商、角色')
  await input.fill('e2e closing term')
  const shownWhileClosing = page.evaluate(
    () =>
      new Promise<string[]>(resolve => {
        const values = new Set<string>()
        const watch = () => {
          const field = document.querySelector<HTMLInputElement>('[role="dialog"] input')
          if (field === null) {
            resolve([...values])
            return
          }
          values.add(field.value)
          requestAnimationFrame(watch)
        }
        watch()
      }),
  )
  await page.mouse.click(8, 400)
  expect(await shownWhileClosing).toEqual(['e2e closing term'])
  await opener.click()
  await expect(input).toHaveValue('')
})

test('sends the legacy search URL to the search page', async ({ page }) => {
  await page.goto('/zh/search/game?q=Re')
  await expect(page).toHaveURL(/\/zh\/search\?q=Re$/)
})

test('negotiates the language from the root URL', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/zh$/)
})

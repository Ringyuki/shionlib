import { expect, test } from '@playwright/test'

test.describe('Docs pages', () => {
  test('docs index should render and navigate to article', async ({ page }) => {
    const response = await page.goto('/en/docs')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page.getByText('About Shionlib').first()).toBeVisible()

    const docLink = page.locator('a[href$="/docs/about/about-shionlib"]').first()
    await expect(docLink).toBeVisible()
    await docLink.click()

    await expect(page).toHaveURL(/\/en\/docs\/about\/about-shionlib$/)
    await expect(page.getByRole('heading', { name: 'About Shionlib' })).toBeVisible()
  })
})

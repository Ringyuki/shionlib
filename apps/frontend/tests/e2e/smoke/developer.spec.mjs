import { expect, test } from '@playwright/test'
import { findFirstDeveloper } from '../_helpers/fixtures.mjs'

test.describe('Developer pages', () => {
  test('should render developer list and navigate to developer detail', async ({
    page,
    request,
  }) => {
    const developer = await findFirstDeveloper(request)

    const response = await page.goto('/en/developer')
    expect(response).not.toBeNull()
    expect(response.ok()).toBeTruthy()

    await expect(page.locator(`a[href$="/developer/${developer.id}"]`).first()).toBeVisible()
    await expect(page.getByText(developer.name).first()).toBeVisible()

    await page.locator(`a[href$="/developer/${developer.id}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/en/developer/${developer.id}(\\?.*)?$`))
    await expect(page.getByText(developer.name).first()).toBeVisible()
  })
})

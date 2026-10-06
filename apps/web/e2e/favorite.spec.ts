import { expect, test } from '@playwright/test'
import { sessionFile, signIn } from './support/accounts'
import { expectNotice } from './support/notices'

test('asks a guest to sign in, then opens the lists', async ({ page }) => {
  await page.goto('/zh/game/4')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '收藏', exact: true }).click()
  await signIn(page, 'e2e_list_all_user')
  await expect(page.getByText('收藏到')).toBeVisible()
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('adds the game to a list and takes it out again', async ({ page }) => {
    await page.goto('/zh/game/2')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    const list = page.getByRole('checkbox').first()
    await list.click()
    await expect(list).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible()
    await page.getByRole('button', { name: '已收藏' }).click()
    await list.click()
    await expect(list).not.toBeChecked()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '收藏', exact: true })).toBeVisible()
  })

  test('creates a list and saves the game into it', async ({ page }) => {
    const name = `E2E ${Date.now()}`
    await page.goto('/zh/game/5')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '收藏', exact: true }).click()
    await page.getByRole('button', { name: '新建收藏夹' }).click()
    const dialog = page.getByRole('dialog', { name: '新建收藏夹' })
    await dialog.getByLabel('名称').fill(name)
    await dialog.getByRole('button', { name: '创建并收藏' }).click()
    await expectNotice(page, `已新建「${name}」并收藏`)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible()
  })
})

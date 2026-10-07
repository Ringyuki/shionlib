import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'

test('asks a guest to sign in', async ({ page }) => {
  await page.goto('/zh/user/uploads')
  await expect(page.getByText('登录后可以查看你上传的资源')).toBeVisible()
})

test.describe('as a member who has uploaded nothing', () => {
  test.use({ storageState: sessionFile('member') })

  test('reaches the empty uploads page from the sidebar', async ({ page }) => {
    await page.goto('/zh')
    await page.getByRole('link', { name: '我的上传' }).click()
    await expect(page).toHaveURL(/\/zh\/user\/uploads$/)
    await expect(page.getByText('尚未上传任何资源')).toBeVisible()
    await expect(page.getByText('新上传者')).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: '上传资源' }).click()
    await expect(page).toHaveURL(/\/zh\/upload$/)
  })
})

test.describe('as an uploader', () => {
  test.use({ storageState: sessionFile('owner') })

  test('lists a published resource by its file, with the game and one menu for both', async ({
    page,
  }) => {
    await page.goto('/zh/user/uploads')
    const resource = page.locator('article').filter({ hasText: 'seeded-reportable-sample.zip' })
    await expect(resource.getByRole('link', { name: /常轨脱离Creative/ })).toHaveAttribute(
      'href',
      '/zh/game/1#resource-1',
    )
    await expect(resource.getByText('已发布')).toBeVisible()
    await expect(resource.getByRole('button', { name: '文件操作' })).toHaveCount(0)
    await resource.getByRole('button', { name: '资源操作' }).click()
    await expect(page.getByRole('menuitem', { name: '添加文件' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '重命名文件' })).toBeVisible()
  })

  test('narrows the list by file name and by status', async ({ page }) => {
    await page.goto('/zh/user/uploads')
    const resource = page.locator('article').filter({ hasText: 'seeded-reportable-sample.zip' })
    const search = page.getByRole('searchbox', { name: '搜索游戏名称或文件名' })
    const stage = (name: RegExp) => page.getByLabel('按状态筛选').getByRole('button', { name })
    await search.fill('no-such-file')
    await expect(page).toHaveURL(/q=no-such-file/)
    await expect(page.getByText('没有符合条件的资源')).toBeVisible()
    await search.fill('')
    await expect(page).not.toHaveURL(/q=/)
    await stage(/处理中/).click()
    await expect(page).toHaveURL(/status=processing/)
    await expect(resource).toHaveCount(0)
    await stage(/上传中/).click()
    await expect(page.getByText('当前没有正在上传的文件')).toBeVisible()
    await stage(/上传中/).click()
    await expect(page).not.toHaveURL(/status=/)
    await expect(resource).toBeVisible()
  })

  test('sends a page past the end to the last one', async ({ page }) => {
    await page.goto('/zh/user/uploads?page=99')
    await expect(page).toHaveURL(/\/zh\/user\/uploads$/)
  })
})

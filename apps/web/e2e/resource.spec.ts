import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

async function openAction(page: Page, action: string) {
  await page.goto('/zh/game/1')
  await page.waitForLoadState('networkidle')
  await page.locator('#resource-1').getByRole('button', { name: '资源操作' }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })
  test.describe.configure({ retries: 0 })

  test('reports a resource once', async ({ page }) => {
    await openAction(page, '举报')
    const dialog = page.getByRole('dialog', { name: '举报资源' })
    await dialog.getByRole('button', { name: '提交举报' }).click()
    await expectNotice(page, '已收到举报，我们将尽快处理')
    await page.locator('#resource-1').getByRole('button', { name: '资源操作' }).click()
    await page.getByRole('menuitem', { name: '举报' }).click()
    await dialog.getByRole('button', { name: '提交举报' }).click()
    await expectNotice(page, '你已举报过该资源，等待审核中')
    await expect(dialog).toBeVisible()
  })
})

test.describe('as the uploader', () => {
  test.use({ storageState: sessionFile('owner') })

  test('edits the note with the BBCode editor and previews it', async ({ page }) => {
    await openAction(page, '编辑资源')
    const dialog = page.getByRole('dialog', { name: '编辑资源' })
    const note = dialog.getByRole('textbox', { name: '说明' })
    await note.fill('Edited by E2E')
    await note.selectText()
    await dialog.getByRole('button', { name: '粗体' }).click()
    await expect(note).toHaveValue('[b]Edited by E2E[/b]')
    await dialog.getByRole('button', { name: '预览' }).click()
    await expect(dialog.locator('strong', { hasText: 'Edited by E2E' })).toBeVisible()
    await dialog.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '资源已更新')
    await expect(page.locator('#resource-1 strong', { hasText: 'Edited by E2E' })).toBeVisible()
  })

  test('shows that a file has not been replaced yet', async ({ page }) => {
    await openAction(page, '历史')
    const dialog = page.getByRole('dialog', { name: '替换记录' })
    await expect(dialog.getByText('这个文件尚未被替换过')).toBeVisible()
  })
})

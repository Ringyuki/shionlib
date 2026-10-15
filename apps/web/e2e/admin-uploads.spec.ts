import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const uploading = 'e2e-uploading.7z'
const unreadable = 'e2e-unreadable.7z'
const uploader = 'e2e_managed_user'

test.describe('as an administrator', () => {
  test.use({ storageState: sessionFile('admin') })
  test.describe.configure({ mode: 'serial', retries: 0 })

  test('shows why an upload in progress failed', async ({ page }) => {
    await page.goto('/zh/admin/uploads')
    const uploads = page.getByRole('table', { name: '上传' })
    const row = uploads.getByRole('row', { name: new RegExp(uploading) })
    await expect(row).toContainText('上传中')
    await expect(row).toContainText('40% · 2/5 片')
    await row.click()
    await expect(page).toHaveURL(/\/zh\/admin\/uploads\?id=\d+$/)
    const detail = page.getByRole('dialog', { name: '上传详情' })
    await expect(detail).toContainText('2 / 5（40%）')
    await expect(detail).toContainText('失败记录 1')
    await expect(detail).toContainText('发送分片 · 第 3 片')
    await expect(detail).toContainText('HTTP 403')
    await expect(detail).toContainText('没有请求 ID，响应不是由本站接口返回的')
    await expect(detail).toContainText('8f3c2a1b9d7e4c21-HKG')
    await expect(detail).toContainText('TypeError: Failed to fetch')
    await expect(detail).toContainText('Chrome 141，Windows')
    await expect(detail.getByRole('button', { name: '终止上传' })).toBeVisible()
  })

  test('shows a file that failed before its upload began', async ({ page }) => {
    await page.goto('/zh/admin/uploads')
    await page.getByRole('combobox', { name: '按状态筛选' }).click()
    await page.getByRole('option', { name: '未能开始' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/uploads\?stage=not_started$/)
    const uploads = page.getByRole('table', { name: '上传' })
    await uploads.getByRole('row', { name: new RegExp(unreadable) }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/uploads\?stage=not_started&attempt=\d+$/)
    const detail = page.getByRole('dialog', { name: '上传详情' })
    await expect(detail).toContainText('这个文件在开始上传之前就失败了，服务器上没有对应的上传')
    await expect(detail).toContainText('NotReadableError')
    await expect(detail.getByRole('button', { name: '终止上传' })).toHaveCount(0)
  })

  test('lists the uploads of one user from their details', async ({ page }) => {
    await page.goto(`/zh/admin/users?q=${uploader}`)
    await page.getByRole('row', { name: new RegExp(`${uploader}@`) }).click()
    await page.getByRole('link', { name: '上传记录' }).click()
    await expect(page).toHaveURL(/\/zh\/admin\/uploads\?user=\d+$/)
    await expect(page.getByText(`上传者：${uploader}`)).toBeVisible()
    const uploads = page.getByRole('table', { name: '上传' })
    await expect(uploads.getByRole('row', { name: new RegExp(uploading) })).toBeVisible()
    await expect(uploads.getByRole('row', { name: new RegExp(unreadable) })).toBeVisible()
    await page.getByRole('checkbox', { name: '只看有失败记录' }).check()
    await expect(page).toHaveURL(/\/zh\/admin\/uploads\?user=\d+&failed=1$/)
    await expect(uploads.getByRole('row')).toHaveCount(3)
  })

  test('terminates an upload in progress', async ({ page }) => {
    await page.goto('/zh/admin/uploads?stage=uploading')
    await page.getByRole('row', { name: new RegExp(uploading) }).click()
    const detail = page.getByRole('dialog', { name: '上传详情' })
    await detail.getByRole('button', { name: '终止上传' }).click()
    const confirm = page.getByRole('alertdialog', { name: '确定要终止这个上传吗？' })
    await confirm.getByRole('button', { name: '终止上传' }).click()
    await expectNotice(page, '上传已终止')
    await expect(confirm).toBeHidden()
    await expect(detail).toContainText('已取消')
    await expect(detail.getByRole('button', { name: '终止上传' })).toHaveCount(0)
    await page.goto('/zh/admin/uploads?stage=canceled')
    await expect(
      page.getByRole('table', { name: '上传' }).getByRole('row', { name: new RegExp(uploading) }),
    ).toContainText('2/5 片')
  })
})

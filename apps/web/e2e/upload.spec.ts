import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, type Page, type TestInfo } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { test } from './support/ingress'
import { expectNotice } from './support/notices'

const mib = 1 << 20

const chunkRoute = '**/uploads/large/*/chunks/*'

async function sampleFile(testInfo: TestInfo, name: string, size: number) {
  const path = testInfo.outputPath(name)
  await writeFile(path, randomBytes(size))
  return path
}

async function uploadResource(page: Page, files: string[]) {
  await page.goto('/zh/upload?game=6')
  await page.locator('input[type="file"]').setInputFiles(files)
  await page.getByRole('group', { name: '平台' }).getByRole('button', { name: 'Windows' }).click()
  await page.getByRole('group', { name: '语言' }).getByRole('button', { name: '日文' }).click()
  await page.getByRole('button', { name: '开始上传' }).click()
  await expect(page).toHaveURL(/\/zh\/game\/6$/)
  await expectNotice(page, '已开始上传，可以在右上角查看进度')
}

function resourceWith(page: Page, fileName: string) {
  return page.locator('article').filter({ hasText: fileName })
}

function chunkIndex(url: string) {
  return url.split('/chunks/')[1] ?? ''
}

test.describe('as an uploader', () => {
  test.use({ storageState: sessionFile('owner') })
  test.describe.configure({ mode: 'serial' })

  test('uploads files into a new resource and adds one more', async ({ page }, testInfo) => {
    const first = await sampleFile(testInfo, 'e2e-new-a.7z', 2 * mib + 17)
    const second = await sampleFile(testInfo, 'e2e-new-b.7z', 1024)
    await uploadResource(page, [first, second])
    const resource = resourceWith(page, 'e2e-new-a.7z')
    await expect(resource.getByText('e2e-new-b.7z')).toBeVisible({ timeout: 60_000 })

    await resource.getByRole('button', { name: '资源操作' }).click()
    await page.getByRole('menuitem', { name: '添加文件' }).click()
    const dialog = page.getByRole('dialog', { name: '添加文件' })
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(await sampleFile(testInfo, 'e2e-new-c.7z', 4096))
    await dialog.getByRole('button', { name: '开始上传' }).click()
    await expect(resource.getByText('e2e-new-c.7z')).toBeVisible({ timeout: 60_000 })
  })

  test('resumes after a reload without sending finished chunks again', async ({
    page,
  }, testInfo) => {
    const file = await sampleFile(testInfo, 'e2e-resume.7z', 3 * mib + 5)
    const held = new Set<string>()
    const resent = new Set<string>()
    let reloaded = false
    await page.route(chunkRoute, async route => {
      const index = chunkIndex(route.request().url())
      if (reloaded) {
        resent.add(index)
      } else if (index !== '0') {
        held.add(index)
        return
      }
      await route.fallback()
    })
    await uploadResource(page, [file])
    await expect.poll(() => [...held].sort()).toEqual(['1', '2', '3'])

    reloaded = true
    await page.reload()
    await page.getByRole('button', { name: '上传任务' }).click()
    await expect(page.getByText('需要重新选择文件')).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles(file)
    await expect(page.getByText('已完成', { exact: true })).toBeVisible({ timeout: 60_000 })
    await expect(resourceWith(page, 'e2e-resume.7z')).toBeVisible()
    expect([...resent].sort()).toEqual(['1', '2', '3'])
  })
})

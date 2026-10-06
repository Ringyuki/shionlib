import { expect, test } from '@playwright/test'
import { expectNotice } from './support/notices'

test('verifies a guest before asking the API for the link', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.waitForLoadState('networkidle')
  await page.locator('#resource-1').getByRole('button', { name: '下载', exact: true }).click()
  await expect(page.getByText('正在确认你不是机器人')).toBeVisible()
  await expectNotice(page, '下载资源文件不存在')
})

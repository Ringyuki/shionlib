import { writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { storedZip } from './support/archives'
import { test } from './support/ingress'

test.describe('composing with a patch', () => {
  test.use({ storageState: sessionFile('admin') })

  test('says why a game without a portable original cannot be composed', async ({ page }) => {
    await page.goto('/zh/upload?game=6')
    await page.getByRole('button', { name: '用补丁合成' }).click()
    await expect(page).toHaveURL(/mode=compose/)
    await expect(page.getByText('合成需要免安装的原版，这个游戏暂无可用作原版的资源')).toBeVisible()
    await expect(page.getByRole('button', { name: '下一步' })).toBeDisabled()
    await page.getByRole('button', { name: '上传免安装的原版' }).click()
    await expect(page).toHaveURL(/\/zh\/upload\?game=6$/)
  })

  test('lays a patch over an original and queues the composition', async ({ page }, testInfo) => {
    const patch = testInfo.outputPath('e2e-汉化补丁.zip')
    await writeFile(
      patch,
      storedZip({ '汉化补丁/patch.xp3': 'chinese script', '汉化补丁/game_chs.exe': 'MZ chinese' }),
    )
    await page.goto('/zh/upload?game=4&mode=compose')
    const original = page.getByRole('listbox', { name: '原版' })
    await expect(original.getByRole('option', { name: /DL版 \(files\)\.7z/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page).toHaveURL(/step=patch/)

    await page.locator('input[type="file"]').setInputFiles(patch)
    await page.getByRole('group', { name: '语言' }).getByRole('button', { name: '简中' }).click()
    await page.getByRole('group', { name: '翻译' }).getByRole('button', { name: '汉化组' }).click()
    const translators = page.getByRole('combobox', { name: '汉化组' })
    await translators.fill('green')
    await page.getByRole('option', { name: /绿茶汉化组/ }).click()
    await page.getByLabel('补丁版本').fill('v1.1')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page).toHaveURL(/step=files/)

    await expect(page.getByText('合成后共 4 个文件')).toBeVisible({ timeout: 60_000 })
    const changes = page.getByRole('list', { name: '合成后的游戏目录' })
    await expect(changes.getByRole('listitem').filter({ hasText: 'game_chs.exe' })).toContainText(
      '新增',
    )
    await expect(changes.getByRole('listitem').filter({ hasText: 'patch.xp3' })).toContainText(
      '替换',
    )
    await expect(page.getByText('汉化补丁', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page).toHaveURL(/step=extras/)

    const name = page.getByText(/\[绿茶汉化组\]\[v1\.1\] \(files\)\.7z$/)
    await expect(name).toBeVisible()
    const fileName = (await name.textContent()) ?? ''
    await page.getByRole('button', { name: '开始合成' }).click()
    await expect(page).toHaveURL(/\/zh\/user\/uploads\?status=processing$/)
    const entry = page.locator('article').filter({ hasText: fileName })
    await expect(entry.getByText(/^(排队中|合成中|合成失败)$/)).toBeVisible()
  })
})

test.describe('a composition that has not started', () => {
  test.use({ storageState: sessionFile('member') })

  test('waits among the uploads and is offered again before a new one', async ({
    page,
  }, testInfo) => {
    const patch = testInfo.outputPath('e2e-草稿补丁.zip')
    await writeFile(patch, storedZip({ '汉化补丁/patch.xp3': 'draft script' }))
    await page.goto('/zh/upload?game=4&mode=compose')
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page).toHaveURL(/step=patch/)
    await page.locator('input[type="file"]').setInputFiles(patch)
    await page.getByRole('group', { name: '语言' }).getByRole('button', { name: '简中' }).click()
    await page.getByRole('group', { name: '翻译' }).getByRole('button', { name: '汉化组' }).click()
    const translators = page.getByRole('combobox', { name: '汉化组' })
    await translators.fill('green')
    await page.getByRole('option', { name: /绿茶汉化组/ }).click()
    await page.getByRole('button', { name: '下一步' }).click()
    await expect(page).toHaveURL(/step=files/)
    await expect(page.getByText(/合成后共 \d+ 个文件/)).toBeVisible({ timeout: 60_000 })

    await page.goto('/zh/user/uploads?status=uploading')
    const entry = page.locator('article').filter({ hasText: /\[绿茶汉化组\] \(files\)\.7z/ })
    await expect(entry.getByText('未开始', { exact: true })).toBeVisible()
    await expect(entry.getByText('补丁：e2e-草稿补丁.zip')).toBeVisible()
    await expect(entry.getByText(/^将于 .+ 清除$/)).toBeVisible()
    await expect(page.getByText('上传中 1')).toBeVisible()

    await page.goto('/zh/upload?game=4&mode=compose')
    const prompt = page.getByRole('dialog', { name: '这个游戏有尚未开始的合成' })
    await expect(prompt.getByText('补丁：e2e-草稿补丁.zip', { exact: false })).toBeVisible()
    await prompt.getByRole('button', { name: '新建合成' }).click()
    await expect(prompt).toBeHidden()
    await expect(page).not.toHaveURL(/composition=/)

    await page.reload()
    await expect(prompt).toBeVisible()
    await prompt.getByRole('link', { name: '继续合成' }).click()
    await expect(page).toHaveURL(/composition=\d+&step=extras$/)
    await expect(prompt).toBeHidden()

    await page.goto('/zh/user/uploads?status=uploading')
    await entry.getByRole('button', { name: '删除' }).click()
    await page.getByRole('button', { name: '确定' }).click()
    await expect(entry).toHaveCount(0)
  })
})

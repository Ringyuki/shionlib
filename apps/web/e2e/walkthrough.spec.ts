import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'
import { formatted, refused, stubFormatting } from './support/walkthrough-format'

test('shows an empty walkthrough tab and asks a guest to sign in before writing', async ({
  page,
}) => {
  await page.goto('/zh/game/3')
  await page.getByRole('tab', { name: '攻略' }).click()
  await expect(page).toHaveURL(/\/zh\/game\/3\/walkthrough$/)
  await expect(page.getByText('暂无攻略')).toBeVisible()
  await page.getByRole('link', { name: '写攻略' }).click()
  await expect(page.getByRole('dialog', { name: '登录 Shionlib' })).toBeVisible()
})

test('answers 404 for a walkthrough that does not exist', async ({ page }) => {
  const response = await page.goto('/zh/game/3/walkthrough/999999')
  expect(response?.status()).toBe(404)
})

test('leads the old addresses of the writing page to the one it has now', async ({ page }) => {
  await page.goto('/zh/game/3/walkthrough/new')
  await expect(page).toHaveURL(/\/zh\/game\/3\/walkthrough\/edit$/)
  await expect(page.getByText('登录后可以编写攻略')).toBeVisible()
  await page.goto('/zh/game/3/walkthrough/12/edit')
  await expect(page).toHaveURL(/\/zh\/game\/3\/walkthrough\/edit$/)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })
  test.describe.configure({ mode: 'serial' })

  test('writes routes of steps, follows them on the game page, publishes and deletes them', async ({
    page,
  }) => {
    await page.goto('/zh/game/2/walkthrough')
    await page.getByRole('link', { name: '写攻略' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/edit$/)
    const parts = page.getByRole('navigation', { name: '线路' })
    const name = page.getByRole('textbox', { name: '线路名称' })
    const steps = page.getByRole('textbox', { name: '步骤' })
    const preview = page.getByLabel('预览').getByRole('listitem')

    await parts.getByRole('button', { name: '添加线路' }).click()
    await page.getByRole('combobox', { name: /角色/ }).click()
    await page.getByRole('option', { name: 'ルビイ' }).click()
    await page.keyboard.press('Escape')
    await expect(name).toHaveValue('ルビイ')
    await steps.click()
    await page.keyboard.type('# 【START】\n去天文台\n◆セーブ01')
    await page.getByRole('button', { name: '存档', exact: true }).click()
    await page.keyboard.type('\n留下 | 光线')
    await expect(steps).toHaveValue('# 【START】\n去天文台\n◆セーブ01\n存档 02\n留下 | 光线')
    await expect(preview).toHaveText(['【START】', '1去天文台', '存档 01', '存档 02', '2留下光线'])
    await page.getByRole('textbox', { name: /结局/ }).fill('光 END')

    await parts.getByRole('button', { name: '添加线路' }).click()
    await name.fill('真结局')
    await steps.fill('读档 02\n离开')
    await page.getByRole('combobox', { name: '须先通关的线路' }).click()
    await page.getByRole('option', { name: 'ルビイ' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('textbox', { name: '其他条件' }).fill('二周目')
    await expect(preview.first()).toHaveText('读取存档 02存于「ルビイ」')
    await page.getByRole('textbox', { name: '说明' }).click()
    await page.keyboard.type('开始之前请先安装修正补丁')

    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '游戏库' })
      .click()
    const leave = page.getByRole('alertdialog')
    await expect(leave.getByText('要放弃尚未保存的修改吗？')).toBeVisible()
    await leave.getByRole('button', { name: '继续编辑' }).click()
    await expect(page).toHaveURL(/\/walkthrough\/edit$/)

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expectNotice(page, '草稿已保存')
    await page.goto('/zh/game/2/walkthrough')
    const guide = page.getByRole('region', { name: '攻略' })
    await expect(guide.getByText('草稿', { exact: true })).toBeVisible()
    await expect(guide.getByText('开始之前请先安装修正补丁')).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'ルビイ', level: 2 })).toBeVisible()
    const routes = guide.getByRole('navigation', { name: '线路' })
    await expect(routes.getByRole('link')).toHaveText([/ルビイ$/, /真结局$/])
    await routes.getByRole('link', { name: /真结局/ }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\?route=2$/)
    await expect(guide.getByRole('heading', { name: '真结局', level: 2 })).toBeVisible()
    await expect(guide.getByText('二周目')).toBeVisible()
    await expect(guide.getByText('须先通关')).toBeVisible()
    await guide.getByRole('link', { name: '存于「ルビイ」' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\?route=1#save-2$/)
    await expect(guide.getByRole('list', { name: '步骤' }).getByRole('listitem')).toHaveText([
      '【START】',
      '1去天文台',
      '存档 01',
      '存档 02',
      '2留下光线',
      '光 END',
    ])

    await page.goto('/zh/user/2/walkthroughs')
    const written = page.getByRole('list', { name: '编写的攻略' })
    await expect(written.getByRole('listitem')).toHaveCount(1)
    await expect(written.getByText('草稿', { exact: true })).toBeVisible()
    await expect(written.getByText(/^2 条线路/)).toBeVisible()
    await written.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/edit$/)
    await expect(steps).toHaveValue('# 【START】\n去天文台\n存档 01\n存档 02\n留下 | 光线')

    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expectNotice(page, '攻略已')
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
    await expect(guide.getByText('草稿', { exact: true })).toHaveCount(0)

    await guide.getByRole('link', { name: '编辑我的攻略' }).click()
    await page.getByRole('button', { name: '更多操作' }).click()
    await page.getByRole('menuitem', { name: '删除攻略' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.getByText('攻略删除后无法恢复')).toBeVisible()
    await confirm.getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '攻略已删除')
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
    await expect(page.getByText('暂无攻略')).toBeVisible()
  })

  test('says which route is not finished before publishing and lets unsaved writing go', async ({
    page,
  }) => {
    await page.goto('/zh/game/2/walkthrough')
    await page.getByRole('link', { name: '写攻略' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/edit$/)
    const parts = page.getByRole('navigation', { name: '线路' })
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expectNotice(page, '攻略须有说明或至少一条线路')
    await parts.getByRole('button', { name: '添加线路' }).click()
    await page.getByRole('textbox', { name: '线路名称' }).fill('第一条')
    await page.getByRole('textbox', { name: '步骤' }).fill('左')
    await parts.getByRole('button', { name: '添加线路' }).click()
    await parts.getByRole('button', { name: /第一条/ }).click()
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page.getByText('请填写线路名称')).toBeVisible()
    await expect(page.getByText('请至少填写一步')).toBeVisible()
    await expect(parts.getByRole('button', { name: /未命名线路/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await page.getByRole('textbox', { name: '线路名称' }).fill('第二条')
    await expect(page.getByText('请填写线路名称')).toHaveCount(0)

    await page.getByRole('button', { name: '删除这条线路' }).click()
    await expect(parts.getByRole('button', { name: /第二条/ })).toHaveCount(0)
    await page.evaluate(() => history.back())
    const leave = page.getByRole('alertdialog')
    await expect(leave.getByText('要放弃尚未保存的修改吗？')).toBeVisible()
    await leave.getByRole('button', { name: '放弃修改' }).click()
    await expect(leave).toBeHidden()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
  })
})

test.describe('formatting text', () => {
  test.use({ storageState: sessionFile('member') })

  test('puts the routes formatted from text into the editor and undoes it', async ({ page }) => {
    await stubFormatting(page, formatted)
    await page.goto('/zh/game/3/walkthrough/edit')
    const parts = page.getByRole('navigation', { name: '线路' })
    await parts.getByRole('button', { name: '从文本整理' }).click()
    const dialog = page.getByRole('dialog', { name: '从文本整理' })
    await expect(dialog.getByRole('radiogroup')).toHaveCount(0)
    const source = dialog.getByRole('textbox', { name: /攻略原文/ })
    await dialog.getByRole('button', { name: '开始整理' }).click()
    await expect(source).toHaveAttribute('aria-invalid', 'true')
    await source.fill('共通线\n去天文台')
    await expect(dialog.getByText('8 / 50000')).toBeVisible()
    await dialog.getByRole('button', { name: '开始整理' }).click()
    await expect(dialog.getByText('正在整理…')).toBeVisible()
    await expect(dialog.getByText('通常需要 30 秒到 2 分钟')).toBeVisible()
    await expect(dialog).toBeHidden()

    const notice = page
      .getByRole('status')
      .filter({ hasText: '已整理出 2 条线路，发布前请逐条核对' })
    await expect(notice).toBeVisible()
    await expect(parts.getByRole('button', { name: /共通线/ })).toBeVisible()
    await expect(parts.getByRole('button', { name: /真结局/ })).toBeVisible()
    await expect(page.getByRole('textbox', { name: '线路名称' })).toHaveValue('共通线')
    await expect(page.getByRole('textbox', { name: '步骤' })).toHaveValue('去天文台\n存档 01')
    await expect(page.getByRole('textbox', { name: '说明' })).toContainText(
      '开始之前请先安装修正补丁',
    )

    await parts.getByRole('button', { name: '从文本整理' }).click()
    await expect(dialog.getByRole('radio', { name: '接在现有线路之后' })).toBeChecked()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()

    await notice.getByRole('button', { name: '撤销' }).click()
    await expect(notice).toBeHidden()
    await expect(parts.getByRole('button', { name: /共通线/ })).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: '说明' })).not.toContainText('修正补丁')
  })

  test('keeps the text when formatting fails', async ({ page }) => {
    await stubFormatting(page, refused)
    await page.goto('/zh/game/3/walkthrough/edit')
    await page
      .getByRole('navigation', { name: '线路' })
      .getByRole('button', { name: '从文本整理' })
      .click()
    const dialog = page.getByRole('dialog', { name: '从文本整理' })
    await dialog.getByRole('textbox', { name: '攻略原文' }).fill('共通线\n去天文台')
    await dialog.getByRole('button', { name: '开始整理' }).click()
    await expectNotice(page, '整理失败，请稍后再试')
    await expect(dialog.getByRole('textbox', { name: '攻略原文' })).toHaveValue('共通线\n去天文台')
    await expect(dialog.getByRole('button', { name: '开始整理' })).toBeEnabled()
  })
})

import { expect, test } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

test('lists the walkthroughs of a game on their tab and asks a guest to sign in before writing', async ({
  page,
}) => {
  await page.goto('/zh/game/2')
  await page.getByRole('tab', { name: /攻略/ }).click()
  await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
  await page.getByRole('link', { name: '写攻略' }).click()
  await expect(page.getByRole('dialog', { name: '登录 Shionlib' })).toBeVisible()
})

test('answers 404 for a walkthrough under the address of another game', async ({ page }) => {
  const response = await page.goto('/zh/game/2/walkthrough/999999')
  expect(response?.status()).toBe(404)
})

test.describe('as a member', () => {
  test.use({ storageState: sessionFile('member') })

  test('writes a draft, reads it with its contents, edits and deletes it', async ({ page }) => {
    const title = `E2E 全线攻略 ${Date.now()}`
    const source =
      '前言。\n[h2]共通线[/h2]\n[list]\n[*]选 A\n[*]选 B\n[/list]\n[h3]分支[/h3]\n去海边。'
    await page.goto('/zh/game/2/walkthrough')
    await page.getByRole('link', { name: '写攻略' }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/edit$/)
    await page.getByRole('textbox', { name: /^标题/ }).fill(title)
    await page.getByRole('textbox', { name: /^正文/ }).fill(source)

    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '游戏库' })
      .click()
    const leave = page.getByRole('alertdialog')
    await expect(leave.getByText('尚未保存的修改将会丢失。')).toBeVisible()
    await leave.getByRole('button', { name: '继续编辑' }).click()
    await expect(page).toHaveURL(/\/walkthrough\/edit$/)

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expectNotice(page, '草稿已保存，仅你可见。')
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+$/)
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(page.getByRole('main').getByText('草稿', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '共通线', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: '分支', level: 3 })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: '选 B' })).toBeVisible()
    const contents = page.getByRole('navigation', { name: '目录' })
    await expect(contents.getByRole('link', { name: '共通线' })).toBeVisible()
    await expect(contents.getByRole('link', { name: '分支' })).toBeVisible()
    const reading = page.url()

    await page.getByRole('link', { name: '编辑', exact: true }).click()
    await expect(page).toHaveURL(/walkthrough_id=\d+$/)
    await expect(page.getByRole('textbox', { name: /^正文/ })).toHaveValue(source)
    await page.getByRole('textbox', { name: /^标题/ }).fill(`${title} 改`)
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expectNotice(page, '草稿已保存，仅你可见。')
    await expect(page.getByRole('heading', { name: `${title} 改`, level: 1 })).toBeVisible()

    await page.goto('/zh/user/2/walkthroughs')
    await expect(
      page.getByRole('list', { name: '撰写的攻略' }).getByRole('link', { name: `${title} 改` }),
    ).toHaveAttribute('href', new URL(reading).pathname)

    await page.goto(reading)
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '攻略已删除。')
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough$/)
    await expect(page.getByText(`${title} 改`)).toHaveCount(0)
  })

  test('holds a walkthrough sent for publication until it is reviewed', async ({ page }) => {
    const title = `E2E 待审攻略 ${Date.now()}`
    await page.goto('/zh/game/2/walkthrough/edit')
    await page.getByRole('textbox', { name: /^标题/ }).fill(title)
    await page.getByRole('textbox', { name: /^正文/ }).fill('只有一句。')
    await page.getByRole('button', { name: '发布', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/game\/2\/walkthrough\/\d+$/)
    await expect(page.getByRole('main').getByText(/^(审核中|已隐藏)$/)).toBeVisible()
    await page.getByRole('button', { name: '删除', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: '删除' }).click()
    await expectNotice(page, '攻略已删除。')
  })
})

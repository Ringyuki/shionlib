import { expect, test, type Page } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { expectNotice } from './support/notices'

const fileName = 'seeded-reportable-sample.zip'
const question = 'Seeded question about the resource for E2E.'
const answer = 'Seeded answer from the publisher for E2E.'
const notice = 'Seeded notice from the publisher for E2E.'

const threadOf = (page: Page, text: string) =>
  page.getByRole('list', { name: '评论' }).getByRole('listitem').filter({ hasText: text })

async function openMenu(page: Page, text: string) {
  await threadOf(page, text).getByRole('button', { name: '更多操作' }).first().click()
}

test('opens a resource from its game and reads its tabs', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page.locator('#resource-1').getByRole('link', { name: fileName }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1$/)
  await expect(page).toHaveTitle(`${fileName} | 常轨脱离Creative Re:Re:call | Shionlib`)
  await expect(page.getByRole('heading', { level: 1, name: fileName })).toBeVisible()
  const back = page.getByRole('link', { name: '常轨脱离Creative Re:Re:call' })
  await expect(back).toHaveAttribute('href', '/zh/game/1')
  await expect(page.getByRole('link', { name: 'e2e_mutable_user' })).toHaveAttribute(
    'href',
    '/zh/user/3',
  )
  await expect(page.getByText('尚未读取这个文件的内容')).toBeVisible()

  await page.getByRole('tab', { name: '详细信息' }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/details$/)
  await expect(page.getByText('e2e-seeded-reportable-hash')).toBeVisible()
  await expect(page.getByText('2 KB（2,048 字节）')).toBeVisible()

  await page.getByRole('tab', { name: '变更历史' }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/history$/)
  const published = page
    .getByRole('list', { name: '变更历史' })
    .getByRole('listitem')
    .filter({ hasText: '发布了资源' })
  await expect(published).toContainText('e2e_mutable_user')
  await expect(published).toContainText(fileName)
})

test('keeps the comments of a resource apart from those of its game', async ({ page }) => {
  await page.goto('/zh/resource/1')
  await page.getByRole('tab', { name: /评论/ }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/comments$/)
  const asked = threadOf(page, question)
  await expect(asked.locator('article').filter({ hasText: answer }).last()).toContainText('发布者')
  await expect(threadOf(page, notice)).toContainText('发布者')
  await expect(page.getByText('Seeded root comment for E2E.')).toHaveCount(0)

  await page.goto('/zh/game/1/comments')
  await expect(page.getByText('Seeded root comment for E2E.')).toBeVisible()
  await expect(page.getByText(question)).toHaveCount(0)

  await page.goto('/zh/user/2/comments')
  const written = page
    .getByRole('list', { name: '发表的评论' })
    .getByRole('link')
    .filter({ hasText: question })
  await expect(written).toContainText(`评论《常轨脱离Creative Re:Re:call》的资源 ${fileName}`)
  await expect(written).toHaveAttribute('href', /^\/zh\/resource\/1\/comments\?comment=\d+$/)
  await written.click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/comments#comment-\d+$/)
  await expect(threadOf(page, question)).toBeInViewport()
})

test.describe('as another member', () => {
  test.use({ storageState: sessionFile('member') })

  test('manages their own comment but cannot pin it', async ({ page }) => {
    await page.goto('/zh/resource/1/comments')
    await openMenu(page, question)
    await expect(page.getByRole('menuitem', { name: '编辑', exact: true })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '置顶' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(threadOf(page, notice).getByRole('button', { name: '更多操作' })).toHaveCount(0)
  })
})

test.describe('as the publisher', () => {
  test.use({ storageState: sessionFile('owner') })
  test.describe.configure({ mode: 'serial' })

  test('pins a comment, replaces it after a confirmation and unpins it', async ({ page }) => {
    await page.goto('/zh/resource/1/comments')
    const threads = page.getByRole('list', { name: '评论' }).getByRole('listitem')
    if ((await page.getByText('发布者置顶').count()) > 0) {
      await threads.first().getByRole('button', { name: '更多操作' }).first().click()
      await page.getByRole('menuitem', { name: '取消置顶' }).click()
      await expect(page.getByText('发布者置顶')).toHaveCount(0)
    }
    await expect(threads.first()).toContainText(notice)

    await openMenu(page, question)
    await page.getByRole('menuitem', { name: '置顶' }).click()
    await expectNotice(page, '评论已置顶')
    await expect(threads.first()).toContainText('发布者置顶')
    await expect(threads.first()).toContainText(question)

    await openMenu(page, notice)
    await page.getByRole('menuitem', { name: '置顶' }).click()
    const replace = page.getByRole('alertdialog', { name: '确定要更换置顶评论吗？' })
    await expect(replace).toContainText('当前置顶的评论将取消置顶')
    await replace.getByRole('button', { name: '取消' }).click()
    await expect(threads.first()).toContainText(question)

    await openMenu(page, notice)
    await page.getByRole('menuitem', { name: '置顶' }).click()
    await replace.getByRole('button', { name: '置顶' }).click()
    await expect(replace).toBeHidden()
    await expect(threads.first()).toContainText(notice)
    await expect(page.getByText('发布者置顶')).toHaveCount(1)

    await page.goto('/zh/resource/1/comments?order=oldest')
    await expect(threads.first()).toContainText(notice)

    await openMenu(page, notice)
    await page.getByRole('menuitem', { name: '取消置顶' }).click()
    await expectNotice(page, '已取消置顶')
    await expect(page.getByText('发布者置顶')).toHaveCount(0)
    await expect(threads.first()).toContainText(question)
  })
})

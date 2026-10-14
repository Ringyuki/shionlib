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

test('opens a resource from anywhere on its card but the controls in it', async ({ page }) => {
  await page.goto('/zh/game/1')
  const card = page.locator('#resource-1')
  const whole = card.getByRole('link', { name: `查看 ${fileName} 的详情` })
  await expect(whole).toHaveAttribute('href', '/zh/resource/1')
  await card.getByRole('button', { name: '复制完整校验值' }).click()
  await card.getByRole('button', { name: '资源操作' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/zh\/game\/1$/)
  const name = await card.getByText(fileName).boundingBox()
  await page.mouse.click((name?.x ?? 0) + 8, (name?.y ?? 0) + 8)
  await expect(page).toHaveURL(/\/zh\/resource\/1$/)
})

test('opens a resource from its game and reads its tabs', async ({ page }) => {
  await page.goto('/zh/game/1')
  await page
    .locator('#resource-1')
    .getByRole('link', { name: fileName })
    .click({
      position: { x: 24, y: 24 },
    })
  await expect(page).toHaveURL(/\/zh\/resource\/1$/)
  await expect(page).toHaveTitle('常轨脱离Creative Re:Re:call Windows 英文 下载 - Shionlib')
  await expect(page.getByRole('heading', { level: 1, name: fileName })).toBeVisible()
  const back = page.getByRole('link', { name: '常轨脱离Creative Re:Re:call' })
  await expect(back).toHaveAttribute('href', '/zh/game/1')
  await expect(page.getByRole('link', { name: 'e2e_mutable_user' })).toHaveAttribute(
    'href',
    '/zh/user/3',
  )
  await expect(page.getByText('病毒扫描未发现威胁')).toBeVisible()
  await expect(page.getByRole('tree', { name: '压缩包内的文件' })).toBeVisible()

  await page.getByRole('tab', { name: '详细信息' }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/details$/)
  await expect(page.getByText('2 KB（2,048 字节）')).toBeVisible()
  await expect(
    page.getByText('0c1f4a5d9e7b3a62c8d1f0e4b6a79325d4c8e1f7a0b2c3d4e5f60718293a4b5c'),
  ).toBeVisible()
  const archive = page.getByRole('region', { name: '压缩包' })
  await expect(archive).toContainText('ZIP')
  await expect(archive).toContainText('8 个文件，2 个文件夹')
  await expect(archive).toContainText('3.73 GB')
  await expect(archive).toContainText('Shift_JIS')
  await expect(archive).toContainText('解压时需选择日文编码，否则文件名将显示为乱码')
  const check = page.getByRole('region', { name: '检查' })
  await expect(check).toContainText('已通过 7-Zip 测试')
  await expect(check).toContainText('未发现威胁')
  await expect(check).toContainText('压缩包与光盘映像内的 1 个可执行文件')
  await expect(check).toContainText('ClamAV 1.4.3，病毒库更新于')
  const discs = page.getByRole('region', { name: '光盘映像' })
  await expect(discs).toHaveCount(2)
  await expect(discs.first()).toContainText('DISC2.mdx')
  await expect(discs.first()).toContainText('无法识别')
  await expect(discs.first()).toContainText('无法读取')
  await expect(discs.last()).toContainText('GAME.bin')
  await expect(discs.last()).toContainText('ISO 9660，含 Joliet 扩展')
  await expect(discs.last()).toContainText('SEEDED_GAME')
  await expect(discs.last()).toContainText('1 个文件')

  await page.getByRole('tab', { name: '变更历史' }).click()
  await expect(page).toHaveURL(/\/zh\/resource\/1\/history$/)
  const published = page
    .getByRole('list', { name: '变更历史' })
    .getByRole('listitem')
    .filter({ hasText: '发布了资源' })
  await expect(published).toContainText('e2e_mutable_user')
  await expect(published).toContainText(fileName)
})

const textAnswer = (content: string) =>
  JSON.stringify([
    { _1: 2 },
    'routes/resources.inspection.text',
    { _3: 4 },
    'data',
    { _5: 6, _7: 8 },
    'ok',
    true,
    'result',
    { _9: 10, _11: 12, _13: 14, _15: 16, _17: 18 },
    'id',
    8,
    'name',
    'readme.txt',
    'size',
    26,
    'encoding',
    'shift_jis',
    'content',
    content,
  ])

const shiftJisReadme = Buffer.from([
  0x82, 0xb1, 0x82, 0xcc, 0x83, 0x74, 0x83, 0x40, 0x83, 0x43, 0x83, 0x8b, 0x82, 0xcd, 0x90, 0xe0,
  0x96, 0xbe, 0x8f, 0x91, 0x82, 0xc5, 0x82, 0xb7, 0x81, 0x42,
]).toString('base64')

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test('browses what a file holds, one folder at a time, and filters it by name', async ({
  page,
}) => {
  await page.goto('/zh/resource/1')
  await expect(
    page.getByText('8 个文件，2 个文件夹，解压后 3.73 GB；光盘映像内另有 2 个文件'),
  ).toBeVisible()
  const tree = page.getByRole('tree', { name: '压缩包内的文件' })
  const rows = tree.getByRole('treeitem')
  await expect(rows).toHaveText([
    /^seeded-sample/,
    /^docs/,
    /^bonus\.zip/,
    /^cover\.png/,
    /^DISC2\.mdx/,
    /^GAME\.bin/,
    /^GAME\.cue/,
    /^readme\.txt/,
    /^setup\.exe/,
  ])
  await expect(rows.nth(0)).toContainText('8 项')
  await expect(rows.nth(2)).toContainText('压缩包')
  await expect(rows.nth(2)).toContainText('已加密')
  await expect(rows.nth(2)).toContainText('无法读取')
  await expect(rows.nth(4)).toContainText('光盘映像')
  await expect(rows.nth(4)).toContainText('无法读取')
  await expect(rows.nth(8)).toContainText('5.54 MB')

  await rows.nth(1).click()
  await expect(tree.getByRole('treeitem', { name: /^manual\.txt/ })).toBeVisible()
  await expect(rows).toHaveCount(10)
  await rows.nth(1).click()
  await expect(rows).toHaveCount(9)

  await tree.getByRole('treeitem', { name: /^GAME\.bin/ }).click()
  await expect(rows).toHaveCount(11)
  await expect(tree.getByRole('treeitem', { name: /^SETUP\.EXE/ })).toContainText('268 KB')
  const track = tree.getByRole('treeitem', { name: /^音轨 02/ })
  await expect(track).toContainText('4 分 31 秒')
  await expect(track).toContainText('45.6 MB')
  await tree.getByRole('treeitem', { name: /^GAME\.bin/ }).click()
  await expect(rows).toHaveCount(9)

  const filter = page.getByRole('searchbox', { name: '筛选文件名' })
  await filter.fill('EXE')
  await expect(page).toHaveURL(/\/zh\/resource\/1\?q=EXE$/)
  await expect(page.getByText('2 项匹配')).toBeVisible()
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('setup.exe')
  await expect(rows.first()).toContainText('seeded-sample')
  await expect(rows.last()).toContainText('SETUP.EXE')
  await expect(rows.last()).toContainText('seeded-sample/GAME.bin')

  await filter.fill('nothing-like-this')
  await expect(page.getByText('没有名称包含“nothing-like-this”的文件')).toBeVisible()
  await filter.fill('')
  await expect(page).toHaveURL(/\/zh\/resource\/1$/)
  await expect(rows).toHaveCount(9)
})

test('previews a text file in the encoding it was written in, and a picture', async ({ page }) => {
  await page.route(
    url => url.pathname === '/resources/inspection/text.data',
    route =>
      route.fulfill({
        status: 200,
        contentType: 'text/x-script',
        body: textAnswer(shiftJisReadme),
      }),
  )
  await page.route(
    url => url.pathname === '/resources/inspection/image',
    route => route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
  )
  await page.goto('/zh/resource/1')
  const tree = page.getByRole('tree', { name: '压缩包内的文件' })
  await tree.getByRole('treeitem', { name: /^readme\.txt/ }).click()
  const text = page.getByRole('dialog', { name: 'readme.txt' })
  await expect(text).toContainText('seeded-sample/readme.txt · 26 B · 1 行')
  await expect(text).toContainText('このファイルは説明書です。')
  await text.getByRole('combobox', { name: '编码' }).click()
  await page.getByRole('option', { name: 'GBK' }).click()
  await expect(text).not.toContainText('説明書')
  await text.getByRole('button', { name: '关闭' }).click()
  await expect(text).toBeHidden()

  await tree.getByRole('treeitem', { name: /^cover\.png/ }).click()
  const picture = page.getByRole('img', { name: 'cover.png' })
  await expect(picture).toBeVisible()
  await expect(picture).toHaveAttribute('src', '/resources/inspection/image?entry=4')
  await page.keyboard.press('Escape')
  await expect(picture).toBeHidden()
})

test.describe('as the uploader of a file that was never read', () => {
  test.use({ storageState: sessionFile('admin') })

  test('says so instead of listing anything', async ({ page }) => {
    await page.goto('/zh/resource/2')
    await expect(page.getByText('尚未读取这个文件的内容')).toBeVisible()
    await page.getByRole('tab', { name: '详细信息' }).click()
    await expect(page.getByRole('region', { name: '压缩包' })).toContainText('尚未读取')
  })
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

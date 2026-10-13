import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, type Page, type TestInfo } from '@playwright/test'
import { sessionFile } from './support/accounts'
import { test } from './support/ingress'
import { expectNotice } from './support/notices'

const mib = 1 << 20

const chunkRoute = '**/uploads/large/*/chunks/*'

const clientKey = 'shionlib_upload_client'

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
  await page.getByRole('group', { name: '形态' }).getByRole('button', { name: '免安装' }).click()
  await page.getByRole('button', { name: '开始上传' }).click()
  await expect(page).toHaveURL(/\/zh\/user\/uploads\?status=uploading$/)
}

async function showEveryStage(page: Page) {
  await page
    .getByLabel('按状态筛选')
    .getByRole('button', { name: /上传中/ })
    .click()
  await expect(page).toHaveURL(/\/zh\/user\/uploads$/)
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

  test('follows a new resource on the uploads page and manages its files there', async ({
    page,
  }, testInfo) => {
    const first = await sampleFile(testInfo, 'e2e-new-a.7z', 2 * mib + 17)
    const second = await sampleFile(testInfo, 'e2e-new-b.7z', 1024)
    await uploadResource(page, [first, second])
    await showEveryStage(page)
    const resource = resourceWith(page, 'e2e-new-a.7z')
    await expect(resource.getByText('e2e-new-b.7z')).toBeVisible({ timeout: 60_000 })
    await expect(resource.getByRole('link', { name: 'E2E 管理临时作品 6' })).toHaveAttribute(
      'href',
      /\/zh\/game\/6#resource-\d+$/,
    )

    await resource.getByRole('button', { name: '资源操作' }).click()
    await page.getByRole('menuitem', { name: '添加文件' }).click()
    const dialog = page.getByRole('dialog', { name: '添加文件' })
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(await sampleFile(testInfo, 'e2e-new-c.7z', 4096))
    await dialog.getByRole('button', { name: '开始上传' }).click()
    await expectNotice(page, '已开始上传')
    await expect(resource.getByText('e2e-new-c.7z')).toBeVisible({ timeout: 60_000 })

    const fileAction = async (file: RegExp, action: string) => {
      await resource.getByRole('button', { name: '资源操作' }).click()
      await page.getByRole('menuitem', { name: file }).click()
      await page.getByRole('menuitem', { name: action, exact: true }).click()
    }
    await fileAction(/e2e-new-c/, '重命名')
    const rename = page.getByRole('dialog', { name: '重命名文件' })
    await rename.getByLabel('文件名').fill('e2e-abandoned.7z')
    await rename.getByRole('button', { name: '取消' }).click()
    await expect(rename).toBeHidden()
    await fileAction(/e2e-new-c/, '重命名')
    await expect(rename.getByLabel('文件名')).toHaveValue('e2e-new-c.7z')
    await rename.getByLabel('文件名').fill('e2e-renamed.7z')
    await rename.getByRole('button', { name: '保存' }).click()
    await expectNotice(page, '文件名已修改')
    const renamed = resource.getByRole('listitem').filter({ hasText: 'e2e-renamed' })
    await expect(renamed).toBeVisible()
    await fileAction(/e2e-renamed/, '移除')
    await page.getByRole('alertdialog').getByRole('button', { name: '移除' }).click()
    await expectNotice(page, '文件已移除')
    await expect(renamed).toHaveCount(0)
  })

  test('names the missing volume of a set until it is added and lists the set in its order', async ({
    page,
  }, testInfo) => {
    const third = await sampleFile(testInfo, 'e2e-set.part3.rar', 2048)
    const first = await sampleFile(testInfo, 'e2e-set.part1.rar', 2048)
    await uploadResource(page, [third, first])
    await showEveryStage(page)
    const resource = resourceWith(page, 'e2e-set.part1.rar')
    await expect(resource.getByText('等待分卷')).toHaveCount(2, { timeout: 60_000 })
    await expect(resource.getByRole('listitem')).toHaveText([
      /e2e-set\.part1\.rar/,
      /e2e-set\.part3\.rar/,
    ])
    const game = resource.getByRole('link', { name: 'E2E 管理临时作品 6' })
    const id = (await game.getAttribute('href'))?.split('#resource-')[1] ?? ''
    await page.goto(`/zh/resource/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('e2e-set.part1.rar')
    await expect(
      page.getByText(
        /这组分卷缺少 e2e-set\.part2\.rar，补齐后才会检查。请在 .+ 前通过“添加文件”补传/,
      ),
    ).toBeVisible()
    await expect(page.getByText('分卷补齐后才会读取文件内容')).toBeVisible()

    await page.goto('/zh/user/uploads')
    await resource.getByRole('button', { name: '资源操作' }).click()
    await page.getByRole('menuitem', { name: '添加文件' }).click()
    const dialog = page.getByRole('dialog', { name: '添加文件' })
    await dialog
      .locator('input[type="file"]')
      .setInputFiles(await sampleFile(testInfo, 'e2e-set.part2.rar', 2048))
    await dialog.getByRole('button', { name: '开始上传' }).click()
    await expectNotice(page, '已开始上传')
    await expect(resource.getByRole('listitem')).toHaveText(
      [/e2e-set\.part1\.rar/, /e2e-set\.part2\.rar/, /e2e-set\.part3\.rar/],
      { timeout: 60_000 },
    )
    await expect(resource.getByText('等待分卷')).toHaveCount(0)
  })

  test('asks where a translation comes from and credits the translators that are named', async ({
    page,
  }, testInfo) => {
    await page.goto('/zh/upload?game=6')
    await page
      .locator('input[type="file"]')
      .setInputFiles([await sampleFile(testInfo, 'e2e-info.7z', 1024)])
    await page.getByRole('group', { name: '平台' }).getByRole('button', { name: 'Windows' }).click()
    await expect(page.getByRole('group', { name: '翻译' })).toHaveCount(0)
    await page.getByRole('group', { name: '语言' }).getByRole('button', { name: '简中' }).click()
    await page.getByRole('button', { name: '开始上传' }).click()
    await expect(page.getByText('请选择翻译')).toBeVisible()
    await expect(page.getByText('请选择形态')).toBeVisible()

    await page.getByRole('group', { name: '翻译' }).getByRole('button', { name: '汉化组' }).click()
    await page.getByRole('button', { name: '开始上传' }).click()
    await expect(page.getByText('至少填写一个汉化组')).toBeVisible()
    const translators = page.getByRole('combobox', { name: '汉化组' })
    await translators.fill('green')
    await page.getByRole('option', { name: /绿茶汉化组/ }).click()
    await translators.fill('E2E 新汉化组')
    await page.getByRole('option', { name: '新建“E2E 新汉化组”' }).click()
    await page.getByLabel('补丁版本').fill('v1.1')
    await page.getByLabel('发布页').fill('example.org/patch')
    await page.getByRole('group', { name: '形态' }).getByRole('button', { name: '免安装' }).click()
    await page
      .getByRole('group', { name: '附带内容' })
      .getByRole('button', { name: '全CG存档' })
      .click()
    await page.getByRole('button', { name: '开始上传' }).click()
    await expect(page.getByText('请填写以 http:// 或 https:// 开头的地址')).toBeVisible()
    await page.getByLabel('发布页').fill('https://example.org/patch')
    await page.getByRole('button', { name: '开始上传' }).click()
    await expect(page).toHaveURL(/\/zh\/user\/uploads\?status=uploading$/)
    await showEveryStage(page)
    await expect(resourceWith(page, 'e2e-info.7z')).toBeVisible({ timeout: 60_000 })

    await page.goto('/zh/game/6')
    const card = resourceWith(page, 'e2e-info.7z')
    await expect(card.getByRole('link', { name: '绿茶汉化组' })).toHaveAttribute(
      'href',
      '/zh/translator/1',
    )
    await expect(card.getByRole('link', { name: 'E2E 新汉化组' })).toBeVisible()
    for (const tag of ['v1.1', '免安装', '全CG存档']) {
      await expect(card.getByText(tag, { exact: true })).toBeVisible()
    }
    await card.getByRole('link', { name: /查看 e2e-info\.7z/ }).click()
    await page.getByRole('tab', { name: '详细信息' }).click()
    await expect(page.getByRole('link', { name: 'https://example.org/patch' })).toHaveAttribute(
      'target',
      '_blank',
    )
  })

  test('fills what the name of the chosen file says and shows the canonical name', async ({
    page,
  }, testInfo) => {
    const uploaded = '[E2E] sample [绿茶汉化组][v1.2] (iso+mds).7z'
    await page.goto('/zh/upload?game=6')
    await page
      .locator('input[type="file"]')
      .setInputFiles([await sampleFile(testInfo, uploaded, 64)])
    await page.getByRole('group', { name: '平台' }).getByRole('button', { name: 'Windows' }).click()
    await page.getByRole('group', { name: '语言' }).getByRole('button', { name: '简中' }).click()
    await expect(
      page.getByRole('group', { name: '翻译' }).getByRole('button', { name: '汉化组' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('补丁版本')).toHaveValue('v1.2')
    await expect(
      page.getByRole('group', { name: '形态' }).getByRole('button', { name: '光盘映像' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/ \[绿茶汉化组\]\[v1\.2\] \(iso\+mds\)\.7z$/)).toHaveCount(2)

    await page.getByRole('group', { name: '形态' }).getByRole('button', { name: '免安装' }).click()
    await expect(page.getByText(/ \[绿茶汉化组\]\[v1\.2\] \(files\)\.7z$/)).toBeVisible()
    await page.getByRole('button', { name: '命名规则' }).click()
    await expect(page.getByText('发售日、品牌和标题取自条目')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('switch', { name: '使用规范文件名' }).click()
    await expect(page.getByText(/\(files\)\.7z$/)).toHaveCount(0)
    await expect(page.getByText(uploaded)).toHaveCount(2)
  })

  test('tells on the page of a resource why it cannot be downloaded yet', async ({
    page,
  }, testInfo) => {
    await uploadResource(page, [await sampleFile(testInfo, 'e2e-notice.7z', 2048)])
    await showEveryStage(page)
    const resource = resourceWith(page, 'e2e-notice.7z')
    const game = resource.getByRole('link', { name: 'E2E 管理临时作品 6' })
    await expect(game).toHaveAttribute('href', /#resource-\d+$/, { timeout: 60_000 })
    const id = (await game.getAttribute('href'))?.split('#resource-')[1] ?? ''
    await page.goto(`/zh/resource/${id}`)
    await expect(page.getByRole('heading', { name: 'e2e-notice.7z' })).toBeVisible()
    await expect(page.getByText('正在检查文件的完整性和安全性，资源发布前仅你可见')).toBeVisible()
    await expect(page.getByRole('button', { name: '下载', exact: true })).toBeDisabled()
    await expect(page.getByText('正在读取文件内容')).toBeVisible()
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
    await page.getByRole('button', { name: '重新选择文件' }).click()
    await page
      .getByRole('dialog', { name: '重新选择文件' })
      .locator('input[type="file"]')
      .setInputFiles(file)
    await showEveryStage(page)
    await expect(resourceWith(page, 'e2e-resume.7z')).toBeVisible({ timeout: 60_000 })
    expect([...resent].sort()).toEqual(['1', '2', '3'])
  })

  test('shows an upload running in another browser and offers nothing to do with it', async ({
    page,
    secondBrowser,
  }, testInfo) => {
    const file = await sampleFile(testInfo, 'e2e-elsewhere.7z', 2 * mib + 9)
    let held = true
    await page.route(chunkRoute, async route => {
      if (!held) {
        await route.fallback()
      }
    })
    await uploadResource(page, [file])
    await expect(page.getByRole('button', { name: '暂停上传' })).toBeVisible()

    await secondBrowser.addInitScript(key => window.localStorage.removeItem(key), clientKey)
    const other = await secondBrowser.newPage()
    await other.goto('/zh/user/uploads?status=uploading')
    const elsewhere = other.getByRole('region', { name: '正在其他浏览器或设备中上传的文件' })
    await expect(elsewhere.getByText('e2e-elsewhere.7z')).toBeVisible()
    await expect(elsewhere.getByText('这些文件正在其他浏览器或设备中上传')).toBeVisible()
    await expect(elsewhere.getByRole('button')).toHaveCount(0)
    await expect(other.getByRole('button', { name: '重新选择文件' })).toHaveCount(0)

    held = false
    await page.getByRole('button', { name: '暂停上传' }).click()
    await page.getByRole('button', { name: '继续上传' }).click()
    await showEveryStage(page)
    await expect(resourceWith(page, 'e2e-elsewhere.7z')).toBeVisible({ timeout: 60_000 })
    await other.reload()
    await expect(
      other.getByRole('region', { name: '正在其他浏览器或设备中上传的文件' }),
    ).toHaveCount(0)
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAdjacentDocs, getAllDocs, getDocBySlug } from '../../../../libs/docs/getDocs'

const writeFile = (root: string, relativePath: string, contents: string) => {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, contents)
}

describe('libs/docs/getDocs (unit)', () => {
  let previousCwd = ''
  let sandbox = ''

  beforeEach(() => {
    previousCwd = process.cwd()
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'shionlib-docs-'))
    process.chdir(sandbox)
  })

  afterEach(() => {
    process.chdir(previousCwd)
    fs.rmSync(sandbox, { recursive: true, force: true })
  })

  it('collects mdx metadata and sorts by date desc', () => {
    writeFile(
      sandbox,
      'contents/a.mdx',
      '---\ntitle: Alpha\ndate: 2024-01-01\ndescription: alpha desc\n---\n\nalpha body',
    )
    writeFile(sandbox, 'contents/sub/b.mdx', '---\ntitle: Beta\ndate: 2025-01-01\n---\n\nbeta body')

    const docs = getAllDocs()

    expect(docs.map(doc => doc.slug)).toEqual(['sub/b', 'a'])
    expect(docs[0]?.title).toBe('Beta')
    expect(docs[0]?.text_count).toBeGreaterThanOrEqual(0)
    expect(docs[1]?.description).toBe('alpha desc')
  })

  it('uses localized docs root and falls back to default root for missing localized slug', () => {
    writeFile(
      sandbox,
      'contents/default-only.mdx',
      '---\ntitle: Default\ndate: 2024-01-01\n---\n\nroot content',
    )
    writeFile(
      sandbox,
      'contents/zh/localized.mdx',
      '---\ntitle: Localized\ndate: 2025-02-02\n---\n\nlocal content',
    )

    const localized = getAllDocs('zh')
    expect(localized).toHaveLength(1)
    expect(localized[0]?.slug).toBe('localized')

    const fallbackDoc = getDocBySlug('default-only', 'zh')
    expect(fallbackDoc.slug).toBe('default-only')
    expect(fallbackDoc.frontmatter.title).toBe('Default')

    const localizedDoc = getDocBySlug('localized', 'zh')
    expect(localizedDoc.frontmatter.title).toBe('Localized')
  })

  it('returns adjacent docs based on sorted order', () => {
    writeFile(sandbox, 'contents/older.mdx', '---\ntitle: Older\ndate: 2024-01-01\n---\n\nold')
    writeFile(sandbox, 'contents/newer.mdx', '---\ntitle: Newer\ndate: 2025-01-01\n---\n\nnew')

    const aroundOlder = getAdjacentDocs('older')
    expect(aroundOlder.prev?.slug).toBe('newer')
    expect(aroundOlder.next).toBeNull()

    const aroundNewer = getAdjacentDocs('newer')
    expect(aroundNewer.prev).toBeNull()
    expect(aroundNewer.next?.slug).toBe('older')
  })
})

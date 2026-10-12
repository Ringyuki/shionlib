import { describe, expect, it } from 'vitest'
import {
  docPath,
  docsPath,
  grouped,
  inOrder,
  isRetired,
  isSitePath,
  neighboursOf,
  sameDoc,
  sitePath,
  sourceUrl,
  type DocRef,
} from './docs'

const doc = (category: DocRef['category'], name: string, date: string, order?: number) => ({
  category,
  name,
  date,
  order,
})

const list = inOrder([
  doc('dev', 'dev-overview', '2025-10-28'),
  doc('guides', 'upload-game-files', '2025-10-30', 8),
  doc('about', 'about-shionlib', '2025-10-28'),
  doc('guides', 'lunabox', '2026-03-11'),
  doc('guides', 'favorites', '2026-02-27'),
  doc('guides', 'download-games', '2026-02-27', 1),
])

describe('addresses', () => {
  it('keeps the addresses the documents already have', () => {
    expect(docsPath('zh')).toBe('/zh/docs')
    expect(docPath('ja', { category: 'guides', name: 'download-games' })).toBe(
      '/ja/docs/guides/download-games',
    )
  })

  it('remembers the documents that were taken down', () => {
    expect(isRetired({ category: 'guides', name: 'edit-history-and-undo' })).toBe(true)
    expect(isRetired({ category: 'guides', name: 'edit-info' })).toBe(true)
    expect(isRetired({ category: 'guides', name: 'potatovn-sync' })).toBe(true)
    expect(isRetired({ category: 'about', name: 'edit-info' })).toBe(false)
    expect(isRetired({ category: 'guides', name: 'download-games' })).toBe(false)
  })

  it('points at the source of a document in the repository', () => {
    expect(sourceUrl('en', { category: 'about', name: 'about-shionlib' })).toBe(
      'https://github.com/Ringyuki/shionlib/edit/main/apps/web/app/features/docs/content/en/about/about-shionlib.mdx',
    )
  })
})

describe('the list', () => {
  it('puts guides first and reads a category in the order its documents give', () => {
    expect(list.map(entry => entry.name)).toEqual([
      'download-games',
      'upload-game-files',
      'lunabox',
      'favorites',
      'about-shionlib',
      'dev-overview',
    ])
  })

  it('puts documents without an order after the ordered ones, the newest first, then by name', () => {
    const loose = inOrder([
      doc('guides', 'b', '2026-02-27'),
      doc('guides', 'a', '2026-02-27'),
      doc('guides', 'newer', '2026-03-01'),
      doc('guides', 'placed', '2020-01-01', 30),
    ])
    expect(loose.map(entry => entry.name)).toEqual(['placed', 'newer', 'a', 'b'])
  })

  it('groups documents by category and leaves out an empty one', () => {
    expect(grouped(list).map(group => [group.category, group.docs.length])).toEqual([
      ['guides', 4],
      ['about', 1],
      ['dev', 1],
    ])
    expect(grouped(list.filter(entry => entry.category !== 'about'))).toHaveLength(2)
  })

  it('leads to the documents before and after one, across categories', () => {
    const at = (name: string) => list.find(entry => entry.name === name) ?? list[0]
    expect(neighboursOf(list, { category: 'guides', name: 'download-games' })).toEqual({
      previous: undefined,
      next: at('upload-game-files'),
    })
    expect(neighboursOf(list, { category: 'about', name: 'about-shionlib' })).toEqual({
      previous: at('favorites'),
      next: at('dev-overview'),
    })
    expect(neighboursOf(list, { category: 'dev', name: 'dev-overview' }).next).toBeUndefined()
    expect(neighboursOf(list, { category: 'dev', name: 'unknown' })).toEqual({
      previous: undefined,
      next: undefined,
    })
  })

  it('tells one document from another by category and name', () => {
    expect(
      sameDoc({ category: 'guides', name: 'lunabox' }, { category: 'guides', name: 'lunabox' }),
    ).toBe(true)
    expect(
      sameDoc({ category: 'guides', name: 'lunabox' }, { category: 'about', name: 'lunabox' }),
    ).toBe(false)
  })
})

describe('links written in a document', () => {
  it('tells the pages of this site from other addresses', () => {
    expect(isSitePath('/zh/docs/guides/lunabox')).toBe(true)
    expect(isSitePath('//example.com')).toBe(false)
    expect(isSitePath('https://box.lunarain.site')).toBe(false)
    expect(isSitePath('#安装-lunabox')).toBe(false)
  })

  it('keeps a language the link names and adds the reader’s where it names none', () => {
    expect(sitePath('ja', '/zh/docs/guides/upload-game-files')).toBe(
      '/zh/docs/guides/upload-game-files',
    )
    expect(sitePath('ja', '/docs/guides/potatovn-download')).toBe(
      '/ja/docs/guides/potatovn-download',
    )
    expect(sitePath('en', '/user/settings/download')).toBe('/en/user/settings/download')
    expect(sitePath('zh', '/')).toBe('/zh')
  })
})

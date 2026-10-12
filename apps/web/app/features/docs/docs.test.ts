import { describe, expect, it } from 'vitest'
import {
  docPath,
  docsPath,
  grouped,
  inOrder,
  isSitePath,
  neighboursOf,
  sameDoc,
  sitePath,
  sourceUrl,
  type DocRef,
} from './docs'

const doc = (category: DocRef['category'], name: string, date: string) => ({ category, name, date })

const shelf = inOrder([
  doc('dev', 'dev-overview', '2025-10-28'),
  doc('guides', 'upload-game-files', '2025-10-30'),
  doc('about', 'about-shionlib', '2025-10-28'),
  doc('guides', 'lunabox', '2026-03-11'),
  doc('guides', 'favorites', '2026-02-27'),
  doc('guides', 'download-games', '2026-02-27'),
])

describe('addresses', () => {
  it('keeps the addresses the documents already have', () => {
    expect(docsPath('zh')).toBe('/zh/docs')
    expect(docPath('ja', { category: 'guides', name: 'download-games' })).toBe(
      '/ja/docs/guides/download-games',
    )
  })

  it('points at the source of a document in the repository', () => {
    expect(sourceUrl('en', { category: 'about', name: 'about-shionlib' })).toBe(
      'https://github.com/Ringyuki/shionlib/edit/main/apps/web/app/features/docs/content/en/about/about-shionlib.mdx',
    )
  })
})

describe('the shelf', () => {
  it('puts guides first, then the newest document of a category first, then by name', () => {
    expect(shelf.map(entry => entry.name)).toEqual([
      'lunabox',
      'download-games',
      'favorites',
      'upload-game-files',
      'about-shionlib',
      'dev-overview',
    ])
  })

  it('groups documents by category and leaves out an empty one', () => {
    expect(grouped(shelf).map(group => [group.category, group.docs.length])).toEqual([
      ['guides', 4],
      ['about', 1],
      ['dev', 1],
    ])
    expect(grouped(shelf.filter(entry => entry.category !== 'about'))).toHaveLength(2)
  })

  it('leads to the documents before and after one, across categories', () => {
    const at = (name: string) => shelf.find(entry => entry.name === name) ?? shelf[0]
    expect(neighboursOf(shelf, { category: 'guides', name: 'lunabox' })).toEqual({
      previous: undefined,
      next: at('download-games'),
    })
    expect(neighboursOf(shelf, { category: 'about', name: 'about-shionlib' })).toEqual({
      previous: at('upload-game-files'),
      next: at('dev-overview'),
    })
    expect(neighboursOf(shelf, { category: 'dev', name: 'dev-overview' }).next).toBeUndefined()
    expect(neighboursOf(shelf, { category: 'dev', name: 'unknown' })).toEqual({
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
    expect(sitePath('ja', '/docs/guides/potatovn-sync')).toBe('/ja/docs/guides/potatovn-sync')
    expect(sitePath('en', '/user/settings/download')).toBe('/en/user/settings/download')
    expect(sitePath('zh', '/')).toBe('/zh')
  })
})

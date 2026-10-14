import { describe, expect, it } from 'vitest'
import { locatedEntries, robotsText, sitemapIndex, urlSet } from './indexing'
import { sitemapRequestFrom } from './indexing.schema'

describe('robotsText', () => {
  it('keeps crawlers out of private pages and names the sitemap', () => {
    const text = robotsText('https://shionlib.com')
    expect(text).toContain('Disallow: /api/\n')
    expect(text).toContain('Disallow: /*/user/settings\n')
    expect(text).not.toContain('Disallow: /en')
    expect(text.endsWith('Sitemap: https://shionlib.com/sitemap.xml\n')).toBe(true)
  })
})

describe('sitemaps', () => {
  it('lists the pages of every section after the site pages', () => {
    const index = sitemapIndex('https://shionlib.com', [
      { section: 'game', pages: 1 },
      { section: 'character', pages: 2 },
      { section: 'walkthrough', pages: 0 },
    ])
    expect(index).toContain('<loc>https://shionlib.com/sitemap.xml?section=pages</loc>')
    expect(index).toContain('<loc>https://shionlib.com/sitemap.xml?section=game&amp;page=1</loc>')
    expect(index).toContain(
      '<loc>https://shionlib.com/sitemap.xml?section=character&amp;page=2</loc>',
    )
    expect(index).not.toContain('walkthrough')
  })

  it('leads every entry to its Chinese page with the time it last changed', () => {
    const located = locatedEntries('walkthrough', [
      { id: 4, game_id: 9, modified: '2026-10-02T03:04:05.000Z' },
      { id: 5, game_id: 9 },
    ])
    expect(located).toEqual([
      { path: '/zh/game/9/walkthrough/4', modified: '2026-10-02T03:04:05.000Z' },
      { path: '/zh/game/9/walkthrough/5', modified: undefined },
    ])
    const set = urlSet('https://shionlib.com', located)
    expect(set).toContain(
      '<url><loc>https://shionlib.com/zh/game/9/walkthrough/4</loc><lastmod>2026-10-02T03:04:05.000Z</lastmod></url>',
    )
    expect(set).toContain('<url><loc>https://shionlib.com/zh/game/9/walkthrough/5</loc></url>')
  })
})

describe('sitemapRequestFrom', () => {
  it('reads the section and its page from the address', () => {
    expect(sitemapRequestFrom(new URLSearchParams(''))).toBeUndefined()
    expect(sitemapRequestFrom(new URLSearchParams('section=game&page=2'))).toEqual({
      section: 'game',
      page: 2,
    })
    expect(sitemapRequestFrom(new URLSearchParams('section=pages'))).toEqual({
      section: 'pages',
      page: 1,
    })
    expect(sitemapRequestFrom(new URLSearchParams('section=game&page=0'))).toBeUndefined()
  })
})

import { characterPath } from '~/features/character'
import { developerPath, developersPath } from '~/features/developer'
import { docPath, docsPath, type Doc } from '~/features/docs'
import { gamePath } from '~/features/game'
import { resourcePath } from '~/features/resource'
import { translatorPath, translatorsPath } from '~/features/translator'
import { walkthroughPath } from '~/features/walkthrough'
import type { Schema } from '~/shared/api/types'
import { indexedLocale } from '~/shared/seo/seo'

export type SitemapSection = Schema<'SitemapSectionDTO'>

export type SitemapEntry = Schema<'SitemapEntryDTO'>

export type Section = SitemapSection['section']

export type Located = { path: string; modified?: string | undefined }

const locale = indexedLocale

const pathsOf: Readonly<Record<Section, (entry: SitemapEntry) => string>> = {
  game: entry => gamePath(locale, entry.id),
  resource: entry => resourcePath(locale, entry.id),
  walkthrough: entry => walkthroughPath(locale, entry.game_id ?? 0, entry.id),
  developer: entry => developerPath(locale, entry.id),
  character: entry => characterPath(locale, entry.id),
  translator: entry => translatorPath(locale, entry.id),
}

export const privatePaths = [
  '/api/',
  '/resources/',
  '/out/',
  '/*/search',
  '/*/upload',
  '/*/user/uploads',
  '/*/user/favorites',
  '/*/user/settings',
  '/*/user/password',
  '/*/message',
  '/*/sponsor/new',
  '/*/sponsor/orders/',
  '/*/admin',
  '/*/login',
  '/*/register',
  '/*/game/*/walkthrough/edit',
]

const head =
  '<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n'

function escaped(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function robotsText(siteUrl: string): string {
  const lines = ['User-agent: *', 'Allow: /', ...privatePaths.map(path => `Disallow: ${path}`)]
  return `${lines.join('\n')}\n\nSitemap: ${siteUrl}/sitemap.xml\n`
}

export function sectionAddress(siteUrl: string, section: Section | 'pages', page = 1): string {
  const query = new URLSearchParams({
    section,
    ...(section === 'pages' ? {} : { page: String(page) }),
  })
  return `${siteUrl}/sitemap.xml?${query.toString()}`
}

export function sitemapIndex(siteUrl: string, sections: readonly SitemapSection[]): string {
  const files = [
    sectionAddress(siteUrl, 'pages'),
    ...sections.flatMap(({ section, pages }) =>
      Array.from({ length: pages }, (_, index) => sectionAddress(siteUrl, section, index + 1)),
    ),
  ]
  const entries = files.map(file => `<sitemap><loc>${escaped(file)}</loc></sitemap>`)
  return `${head}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>\n`
}

export function urlSet(siteUrl: string, located: readonly Located[]): string {
  const entries = located.map(({ path, modified }) => {
    const lastmod = modified === undefined ? '' : `<lastmod>${escaped(modified)}</lastmod>`
    return `<url><loc>${escaped(`${siteUrl}${path}`)}</loc>${lastmod}</url>`
  })
  return `${head}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

export function locatedEntries(section: Section, entries: readonly SitemapEntry[]): Located[] {
  return entries.map(entry => ({ path: pathsOf[section](entry), modified: entry.modified }))
}

export function locatedPages(docs: readonly Doc[]): Located[] {
  const pages = [
    `/${locale}`,
    `/${locale}/game`,
    `/${locale}/release`,
    `/${locale}/activity`,
    developersPath(locale),
    translatorsPath(locale),
    docsPath(locale),
    `/${locale}/friend-link`,
    `/${locale}/sponsor`,
  ]
  return [
    ...pages.map(path => ({ path })),
    ...docs.map(doc => ({ path: docPath(locale, doc), modified: doc.date })),
  ]
}

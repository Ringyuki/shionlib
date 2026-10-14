import { data, type LoaderFunctionArgs } from 'react-router'
import { docsIn } from '~/features/docs/docs.server'
import { readServerEnv } from '~/shared/config/env.server'
import { routeLoader } from '~/shared/route/route.server'
import { indexedLocale } from '~/shared/seo/seo'
import { locatedEntries, locatedPages, robotsText, sitemapIndex, urlSet } from './indexing'
import { sitemapRequestFrom } from './indexing.schema'
import { loadIndexNowKey, loadSitemapEntries, loadSitemapSections } from './indexing.use-cases'

const hour = 'public, max-age=3600'

function answer(body: string, type: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': hour },
  })
}

export function robotsLoader() {
  return answer(robotsText(readServerEnv().publicConfig.siteUrl), 'text/plain')
}

export async function indexNowKeyLoader(args: LoaderFunctionArgs) {
  return answer(await routeLoader(args, loadIndexNowKey), 'text/plain')
}

export async function sitemapLoader(args: LoaderFunctionArgs) {
  const siteUrl = readServerEnv().publicConfig.siteUrl
  const asked = sitemapRequestFrom(args.url.searchParams)
  if (asked?.section === 'pages') {
    return answer(urlSet(siteUrl, locatedPages(docsIn(indexedLocale))), 'application/xml')
  }
  const sections = await routeLoader(args, loadSitemapSections)
  if (asked === undefined) {
    return answer(sitemapIndex(siteUrl, sections), 'application/xml')
  }
  const found = sections.find(({ section }) => section === asked.section)
  if (found === undefined || asked.page > found.pages) {
    throw data(null, { status: 404 })
  }
  const entries = await routeLoader(args, api => loadSitemapEntries(api, found.section, asked.page))
  return answer(urlSet(siteUrl, locatedEntries(found.section, entries)), 'application/xml')
}

import type { ApiClient } from '~/shared/api/client'
import type { Section, SitemapEntry, SitemapSection } from './indexing'

export async function loadSitemapSections(api: ApiClient): Promise<SitemapSection[]> {
  return (await api.get('/sitemap/sections')) ?? []
}

export async function loadSitemapEntries(
  api: ApiClient,
  section: Section,
  page: number,
): Promise<SitemapEntry[]> {
  return (await api.get('/sitemap/{section}/{page}', { params: { path: { section, page } } })) ?? []
}

export async function loadIndexNowKey(api: ApiClient): Promise<string> {
  return (await api.get('/indexing/key')).key
}

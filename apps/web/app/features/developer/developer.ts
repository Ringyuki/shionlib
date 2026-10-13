import type { Works } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type DeveloperItem = Schema<'DeveloperListItemDTO'>

export type DeveloperDetail = Schema<'DeveloperDetailDTO'>

export type Developers = { query: string; page: number; items: DeveloperItem[]; total: number }

export type DeveloperContent = { developer: DeveloperDetail; works: Works }

export const pageSize = 48

export const maxQueryLength = 100

export function developersPath(locale: Locale, query = ''): string {
  const base = `/${locale}/developer`
  return query === '' ? base : `${base}?${new URLSearchParams({ q: query })}`
}

export function developerPath(locale: Locale, id: number): string {
  return `/${locale}/developer/${id}`
}

export function normalizedQuery(raw: string | null): string {
  return [...(raw ?? '').trim()].slice(0, maxQueryLength).join('')
}

export function websiteOf(developer: Pick<DeveloperDetail, 'website'>): string | undefined {
  const website = (developer.website ?? '').trim()
  return website === '' ? undefined : website
}

export function extrasOf(developer: Pick<DeveloperDetail, 'extra_info'>) {
  return (developer.extra_info ?? []).filter(
    info => info.key.trim() !== '' && info.value.trim() !== '',
  )
}

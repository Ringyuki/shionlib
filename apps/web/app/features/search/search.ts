import type { ApiData } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type SearchResults = ApiData<'/search', 'get'>

export type GameHit = NonNullable<SearchResults['games']['items']>[number]

export type DeveloperHit = NonNullable<SearchResults['developers']['items']>[number]

export type CharacterHit = NonNullable<SearchResults['characters']['items']>[number]

export type Palette = {
  query: string
  suggestions: string[]
  trending: string[]
  results: SearchResults | null
  unavailable: boolean
}

export const paletteSize = 5

export const resultsPageSize = 20

export const trendingSize = 8

export const suggestionSize = 4

export const maxRecent = 8

export const recentStorageKey = 'shionlib_recent_searches'

export const searchDelayMs = 300

export const maxQueryLength = 100

export function normalizeQuery(raw: string | null | undefined): string {
  return [...(raw ?? '').trim().split(/\s+/).join(' ')].slice(0, maxQueryLength).join('')
}

export function rememberSearch(recent: readonly string[], query: string): string[] {
  const normalized = normalizeQuery(query)
  if (normalized === '') {
    return [...recent]
  }
  const others = recent.filter(entry => entry.toLowerCase() !== normalized.toLowerCase())
  return [normalized, ...others].slice(0, maxRecent)
}

export function parseRecent(stored: string | null): string[] {
  if (stored === null) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter(entry => typeof entry === 'string')
      .map(entry => normalizeQuery(entry))
      .filter(entry => entry !== '')
      .slice(0, maxRecent)
  } catch {
    return []
  }
}

export function pageParam(raw: string | null): number {
  const page = Number(raw)
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size))
}

export function emptyResults(): SearchResults {
  return {
    games: { items: [], total: 0 },
    developers: { items: [], total: 0 },
    characters: { items: [], total: 0 },
  }
}

export function characterName(hit: CharacterHit, locale: Locale): string {
  const localized = locale === 'zh' ? hit.name_zh : locale === 'en' ? hit.name_en : null
  return localized?.trim() || hit.name_jp
}

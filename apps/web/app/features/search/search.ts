import type { ApiData } from '~/shared/api/types'

export type SearchResults = ApiData<'/search', 'get'>

export type GameHit = NonNullable<SearchResults['games']['items']>[number]

export type DeveloperHit = NonNullable<SearchResults['developers']['items']>[number]

export type Palette = {
  query: string
  suggestions: string[]
  trending: string[]
  results: SearchResults | null
  unavailable: boolean
}

export const paletteSize = 5

export const pickerSize = 8

export const recentReleaseSize = 100

export const resultsPageSize = 20

export const trendingSize = 8

export const suggestionSize = 4

export const maxRecent = 8

export const recentStorageKey = 'shionlib_recent_searches'

export const searchDelayMs = 300

export const maxQueryLength = 100

export type PictureShape = 'cover' | 'portrait' | 'logo'

export type Picture = { src: string | undefined; shape: PictureShape }

export type ReleaseMonths<Game = GameHit> = { thisMonth: Game[]; lastMonth: Game[] }

export function releaseWindow(now: Date) {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return {
    start: first.toISOString().slice(0, 10),
    end: last.toISOString().slice(0, 10),
    lastMonth: first.toISOString().slice(0, 7),
    thisMonth: last.toISOString().slice(0, 7),
  }
}

export function byReleaseMonth<Game extends Pick<GameHit, 'release_date'>>(
  games: readonly Game[],
  window: ReturnType<typeof releaseWindow>,
): ReleaseMonths<Game> {
  const releasedIn = (month: string) =>
    games.filter(game => game.release_date?.slice(0, 7) === month)
  return { thisMonth: releasedIn(window.thisMonth), lastMonth: releasedIn(window.lastMonth) }
}

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

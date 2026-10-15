import type { ResourceRule } from '~/features/game'
import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { fileBody } from '~/shared/api/file-body'
import {
  emptyResults,
  normalizeQuery,
  paletteSize,
  byReleaseMonth,
  pickerSize,
  recentReleaseSize,
  releaseWindow,
  resultsPageSize,
  suggestionSize,
  trendingSize,
  type GameHit,
  type Palette,
  type ReleaseMonths,
  type SearchResults,
} from './search'

async function quietly<Result>(request: Promise<Result>, fallback: Result): Promise<Result> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError) {
      return fallback
    }
    throw error
  }
}

async function attempt(request: Promise<SearchResults>) {
  try {
    return { results: await request, unavailable: false }
  } catch (error) {
    if (error instanceof ApiError) {
      return { results: emptyResults(), unavailable: true }
    }
    throw error
  }
}

async function loadTrending(api: ApiClient): Promise<string[]> {
  const terms = await quietly(
    api.get('/search/trending', { params: { query: { limit: trendingSize } } }),
    [],
  )
  return (terms ?? []).map(term => term.query)
}

export async function loadPalette(api: ApiClient, raw: string): Promise<Palette> {
  const query = normalizeQuery(raw)
  if (query === '') {
    const [trending, imageSource] = await Promise.all([
      loadTrending(api),
      quietly(api.get('/search/image/source'), null),
    ])
    return { query, suggestions: [], trending, results: null, unavailable: false, imageSource }
  }
  const [suggestions, found] = await Promise.all([
    quietly(
      api.get('/search/suggest', { params: { query: { prefix: query, limit: suggestionSize } } }),
      [],
    ),
    attempt(
      api.get('/search', {
        params: {
          query: { q: query, types: ['game', 'developer', 'character'], pageSize: paletteSize },
        },
      }),
    ),
  ])
  return {
    query,
    suggestions: (suggestions ?? []).filter(title => title.toLowerCase() !== query.toLowerCase()),
    trending: [],
    results: found.results,
    unavailable: found.unavailable,
    imageSource: null,
  }
}

export async function searchGames(
  api: ApiClient,
  raw: string,
  page: number,
  resources: ResourceRule | undefined,
) {
  const query = normalizeQuery(raw)
  if (query === '') {
    return {
      query,
      page,
      resources,
      games: emptyResults().games,
      trending: await loadTrending(api),
      unavailable: false,
    }
  }
  const found = await attempt(
    api.get('/search', {
      params: {
        query: {
          q: query,
          types: ['game'],
          page,
          pageSize: resultsPageSize,
          resources,
        },
      },
    }),
  )
  if (page === 1 && !found.unavailable) {
    await quietly(recordSearch(api, query), null)
  }
  return {
    query,
    page,
    resources,
    games: found.results.games,
    trending: [],
    unavailable: found.unavailable,
  }
}

export async function recordSearch(api: ApiClient, raw: string) {
  const query = normalizeQuery(raw)
  if (query !== '') {
    await api.post('/search/record', { body: { q: query } })
  }
  return null
}

export async function findGames(api: ApiClient, raw: string): Promise<GameHit[]> {
  const query = normalizeQuery(raw)
  if (query === '') {
    return []
  }
  const found = await quietly(
    api.get('/search', {
      params: {
        query: { q: query, types: ['game'], pageSize: pickerSize, resources: 'any' },
      },
    }),
    null,
  )
  return found?.games.items ?? []
}

export async function loadRecentReleases(api: ApiClient, now: Date): Promise<ReleaseMonths> {
  const window = releaseWindow(now)
  const page = await quietly(
    api.get('/game/list', {
      params: {
        query: {
          pageSize: recentReleaseSize,
          resources: 'any',
          'filter[start_date]': window.start,
          'filter[end_date]': window.end,
          'filter[sort_by]': 'release_date',
          'filter[sort_order]': 'desc',
        },
      },
    }),
    null,
  )
  return byReleaseMonth(page?.items ?? [], window)
}

export async function searchByImage(api: ApiClient, image: File) {
  return api.post('/search/image', fileBody('file', image))
}

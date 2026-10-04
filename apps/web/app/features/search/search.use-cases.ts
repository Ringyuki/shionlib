import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  emptyResults,
  normalizeQuery,
  paletteSize,
  resultsPageSize,
  suggestionSize,
  trendingSize,
  type Palette,
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

export async function loadPalette(api: ApiClient, raw: string): Promise<Palette> {
  const query = normalizeQuery(raw)
  if (query === '') {
    const terms = await quietly(
      api.get('/search/trending', { params: { query: { limit: trendingSize } } }),
      [],
    )
    return {
      query,
      suggestions: [],
      trending: (terms ?? []).map(term => term.query),
      results: null,
      unavailable: false,
    }
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
  }
}

export async function searchGames(api: ApiClient, raw: string, page: number) {
  const query = normalizeQuery(raw)
  if (query === '') {
    return { query, page, games: emptyResults().games, unavailable: false }
  }
  const found = await attempt(
    api.get('/search', {
      params: { query: { q: query, types: ['game'], page, pageSize: resultsPageSize } },
    }),
  )
  if (page === 1 && !found.unavailable) {
    await quietly(recordSearch(api, query), null)
  }
  return { query, page, games: found.results.games, unavailable: found.unavailable }
}

export async function recordSearch(api: ApiClient, raw: string) {
  const query = normalizeQuery(raw)
  if (query !== '') {
    await api.post('/search/record', { body: { q: query } })
  }
  return null
}

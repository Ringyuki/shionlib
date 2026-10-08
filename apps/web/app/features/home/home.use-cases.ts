import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  hotSize,
  monthWindow,
  recentSize,
  releasesSize,
  type Block,
  type HomeContent,
} from './home'

async function block<Data>(request: Promise<Data>): Promise<Block<Data>> {
  try {
    return { ok: true, data: await request }
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false }
    }
    throw error
  }
}

async function recentGames(api: ApiClient) {
  const found = await api.get('/game/list', {
    params: { query: { pageSize: recentSize, 'filter[sort_by]': 'resource_updated' } },
  })
  return found.items ?? []
}

async function monthReleases(api: ApiClient, start: string, end: string) {
  const found = await api.get('/game/list', {
    params: {
      query: {
        pageSize: releasesSize,
        resources: 'any',
        'filter[start_date]': start,
        'filter[end_date]': end,
        'filter[sort_by]': 'release_date',
        'filter[sort_order]': 'asc',
      },
    },
  })
  return found.items ?? []
}

async function hotGames(api: ApiClient) {
  const found = await api.get('/game/list', {
    params: { query: { pageSize: hotSize, 'filter[sort_by]': 'hot_score' } },
  })
  return found.items ?? []
}

export async function loadHome(api: ApiClient, now: Date): Promise<HomeContent> {
  const window = monthWindow(now)
  const [recent, releases, hot] = await Promise.all([
    block(recentGames(api)),
    block(monthReleases(api, window.start, window.end)),
    block(hotGames(api)),
  ])
  return { month: window.month, recent, releases, hot }
}

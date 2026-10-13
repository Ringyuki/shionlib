import type { GameSummary, ResourceRule } from '~/features/game'
import type { ApiClient } from '~/shared/api/client'
import {
  byDay,
  currentMonth,
  maxPages,
  monthWindow,
  pageSize,
  sameMonth,
  type ReleaseMonth,
  type Releases,
} from './release'

export async function loadReleases(
  api: ApiClient,
  month: ReleaseMonth,
  resources: ResourceRule | undefined,
  now: Date,
): Promise<Releases> {
  const window = monthWindow(month)
  const games: GameSummary[] = []
  let total = 0
  for (let page = 1; page <= maxPages; page += 1) {
    const found = await api.get('/game/list', {
      params: {
        query: {
          page,
          pageSize,
          resources: resources ?? 'any',
          'filter[start_date]': window.start,
          'filter[end_date]': window.end,
          'filter[sort_by]': 'release_date',
          'filter[sort_order]': 'asc',
        },
      },
    })
    games.push(...(found.items ?? []))
    total = found.meta.totalItems
    if (page >= found.meta.totalPages) {
      break
    }
  }
  return {
    month,
    current: sameMonth(month, currentMonth(now)),
    resources,
    days: byDay(games),
    total,
  }
}

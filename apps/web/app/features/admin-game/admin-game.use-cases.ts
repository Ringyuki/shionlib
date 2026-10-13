import type { ApiClient } from '~/shared/api/client'
import type { Filter, Game } from './admin-game'
import type { GameChange } from './admin-game.schema'

export type Listing = {
  filter: Filter
  games: Game[]
  total: number
}

export async function loadGames(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const page = await api.get('/admin/content/games', {
    params: {
      query: {
        page: filter.page,
        pageSize,
        sortBy: filter.sort,
        sortOrder: 'desc',
        ...(filter.query === '' ? {} : { search: filter.query }),
        ...(filter.status === undefined ? {} : { status: filter.status }),
      },
    },
  })
  return { filter, games: page.items ?? [], total: page.meta.totalItems }
}

export async function changeGame(api: ApiClient, change: GameChange): Promise<null> {
  const params = { path: { id: change.id } }
  switch (change.action) {
    case 'status':
      await api.patch('/admin/content/games/{id}/status', {
        params,
        body: { status: change.status },
      })
      return null
    case 'recent':
      if (change.marked) {
        await api.put('/admin/content/games/{id}/recent-update', { params })
      } else {
        await api.delete('/admin/content/games/{id}/recent-update', { params })
      }
      return null
    case 'refresh':
      await api.post('/admin/catalog/import', {
        body: { source: change.source, entity: 'game', external_id: change.externalId },
      })
      return null
    case 'remove':
      await api.delete('/admin/content/games/{id}', { params })
      return null
  }
}

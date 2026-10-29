import { loadOwnCompositions, unstartedDrafts, type Composition } from '~/features/resource'
import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { pageSize, scopeOf, type Draft, type Listing, type UploaderContent } from './uploader'

export async function loadUploader(
  api: ApiClient,
  listing: Listing,
): Promise<UploaderContent | null> {
  const allowance = await api.get('/uploads/quota').catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  })
  if (allowance === null) {
    return null
  }
  const { stage } = listing
  const [summary, compositions, found] = await Promise.all([
    api.get('/game/download-source/mine/summary'),
    loadOwnCompositions(api),
    stage === 'uploading'
      ? undefined
      : api.get('/game/download-source/mine', {
          params: {
            query: {
              scope: scopeOf(stage),
              ...(listing.search === '' ? {} : { q: listing.search }),
              sort_by: listing.sort,
              sort_order: listing.ascending ? 'asc' : 'desc',
              page: listing.page,
              pageSize,
            },
          },
        }),
  ])
  return {
    allowance,
    summary,
    listing,
    resources: found?.items ?? [],
    compositions,
    drafts: await loadDrafts(api, unstartedDrafts(compositions)),
    total: found?.meta.totalItems ?? 0,
  }
}

async function loadDrafts(api: ApiClient, compositions: Composition[]): Promise<Draft[]> {
  const ids = [...new Set(compositions.map(composition => composition.game_id))]
  const games = await Promise.all(
    ids.map(id =>
      api.get('/game/{id}/header', { params: { path: { id } } }).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }),
    ),
  )
  return compositions.map(composition => ({
    composition,
    game: games.find(game => game?.id === composition.game_id) ?? null,
  }))
}

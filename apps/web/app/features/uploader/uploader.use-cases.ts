import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { pageSize, scopeOf, type Listing, type UploaderContent } from './uploader'

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
  const [summary, found] = await Promise.all([
    api.get('/game/download-source/mine/summary'),
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
    total: found?.meta.totalItems ?? 0,
  }
}

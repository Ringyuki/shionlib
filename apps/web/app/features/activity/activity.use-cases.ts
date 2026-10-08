import type { ApiClient } from '~/shared/api/client'
import { categoryOf, happeningsOf, pageSize, type Feed, type FeedKind } from './activity'

export async function loadFeed(api: ApiClient, kind: FeedKind, page: number): Promise<Feed> {
  const found = await api.get('/activity/list', {
    params: { query: { page, pageSize, category: categoryOf(kind) } },
  })
  return {
    kind,
    page,
    happenings: happeningsOf(found.items ?? []),
    total: found.meta.totalItems,
  }
}

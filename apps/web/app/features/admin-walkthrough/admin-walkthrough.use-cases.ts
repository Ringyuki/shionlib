import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  everyStatus,
  heldOnly,
  type Filter,
  type Walkthrough,
  type WalkthroughDetail,
} from './admin-walkthrough'
import type { WalkthroughChange } from './admin-walkthrough.schema'

export type Listing = {
  filter: Filter
  walkthroughs: Walkthrough[]
  total: number
  opened: WalkthroughDetail | undefined
}

async function loadOpened(api: ApiClient, id: number): Promise<WalkthroughDetail | undefined> {
  try {
    return await api.get('/admin/walkthroughs/{id}', { params: { path: { id } } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

function statusQuery(status: Filter['status']) {
  if (status === everyStatus) {
    return {}
  }
  return status === heldOnly ? { held: true } : { status }
}

export async function loadWalkthroughs(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, opened] = await Promise.all([
    api.get('/admin/walkthroughs', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          sortBy: filter.sort,
          sortOrder: 'desc',
          ...statusQuery(filter.status),
          ...(filter.query === '' ? {} : { search: filter.query }),
          ...(filter.author === undefined ? {} : { creatorId: filter.author }),
        },
      },
    }),
    filter.opened === undefined ? undefined : loadOpened(api, filter.opened),
  ])
  return { filter, walkthroughs: page.items ?? [], total: page.meta.totalItems, opened }
}

export async function changeWalkthrough(api: ApiClient, change: WalkthroughChange): Promise<null> {
  const params = { path: { id: change.id } }
  if (change.action === 'rescan') {
    await api.post('/admin/walkthroughs/{id}/rescan', { params })
  } else {
    await api.patch('/admin/walkthroughs/{id}/status', { params, body: { status: change.status } })
  }
  return null
}

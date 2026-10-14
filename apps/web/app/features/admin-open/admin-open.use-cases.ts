import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  rangeDays,
  type AdminKey,
  type Day,
  type Filter,
  type KeyDetail,
  type Summary,
} from './admin-open'
import type { OpenChange } from './admin-open.schema'

export type Listing = {
  filter: Filter
  summary: Summary
  days: Day[]
  keys: AdminKey[]
  total: number
  detail: KeyDetail | undefined
}

async function loadDetail(api: ApiClient, id: number | undefined): Promise<KeyDetail | undefined> {
  if (id === undefined) {
    return undefined
  }
  try {
    return await api.get('/admin/open/keys/{id}', { params: { path: { id } } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadOpen(api: ApiClient, filter: Filter, pageSize: number): Promise<Listing> {
  const [summary, days, page, detail] = await Promise.all([
    api.get('/admin/open/summary'),
    api.get('/admin/open/usage', { params: { query: { days: rangeDays[filter.days] } } }),
    api.get('/admin/open/keys', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          sort: filter.sort,
          ...(filter.status === undefined ? {} : { status: filter.status }),
          ...(filter.query === '' ? {} : { q: filter.query }),
          ...(filter.user === undefined ? {} : { user: filter.user }),
        },
      },
    }),
    loadDetail(api, filter.key),
  ])
  return {
    filter,
    summary,
    days: days ?? [],
    keys: page.items ?? [],
    total: page.meta.totalItems,
    detail,
  }
}

export async function changeOpen(api: ApiClient, change: OpenChange): Promise<null> {
  switch (change.action) {
    case 'suspend':
      await api.post('/admin/open/keys/{id}/suspend', {
        params: { path: { id: change.id } },
        body: { reason: change.reason },
      })
      return null
    case 'restore':
      await api.post('/admin/open/keys/{id}/restore', { params: { path: { id: change.id } } })
      return null
    case 'limit':
      await api.put('/admin/open/accounts/{userId}/limit', {
        params: { path: { userId: change.userId } },
        body: { limit: change.limit },
      })
      return null
  }
}

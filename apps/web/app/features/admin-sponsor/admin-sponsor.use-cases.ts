import type { ApiClient } from '~/shared/api/client'
import type { Filter, Order, Stats } from './admin-sponsor'
import type { OrderChange } from './admin-sponsor.schema'

export type Listing = {
  filter: Filter
  orders: Order[]
  total: number
  stats: Stats
}

export async function loadSponsors(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, stats] = await Promise.all([
    api.get('/admin/sponsor/orders', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          ...(filter.status === undefined ? {} : { status: filter.status }),
        },
      },
    }),
    api.get('/admin/sponsor/stats'),
  ])
  return { filter, orders: page.items ?? [], total: page.meta.totalItems, stats }
}

export async function changeOrder(api: ApiClient, change: OrderChange): Promise<null> {
  const params = { path: { id: change.id } }
  if (change.action === 'status') {
    await api.patch('/admin/sponsor/orders/{id}/status', {
      params,
      body: { status: change.status },
    })
    return null
  }
  await api.delete('/admin/sponsor/orders/{id}', { params })
  return null
}

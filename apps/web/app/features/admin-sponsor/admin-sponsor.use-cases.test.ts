import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter, Stats } from './admin-sponsor'
import { changeOrder, loadSponsors } from './admin-sponsor.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 20,
  totalItems,
  totalPages: 1,
})

const stats: Stats = {
  totalSponsors: 214,
  totalAmount: 1248,
  monthAmount: 68,
  enabled: true,
  providerReady: true,
}

const filter: Filter = { status: undefined, page: 1 }

const sent = (requests: Request[]) =>
  requests.map(request => `${request.method} ${new URL(request.url).pathname}`)

const queryOf = (requests: Request[], path: string) =>
  Object.fromEntries(
    new URL(requests.find(request => new URL(request.url).pathname === path)?.url ?? '')
      .searchParams,
  )

describe('loadSponsors', () => {
  it('loads one page of every order with the totals', async () => {
    const fake = fakeApi()
      .on('get', '/admin/sponsor/orders', { items: null, meta: meta(231) })
      .on('get', '/admin/sponsor/stats', stats)
    await expect(loadSponsors(fake.api, filter, 20)).resolves.toEqual({
      filter,
      orders: [],
      total: 231,
      stats,
    })
    expect(queryOf(fake.requests, '/admin/sponsor/orders')).toEqual({ page: '1', pageSize: '20' })
  })

  it('passes the status on', async () => {
    const fake = fakeApi()
      .on('get', '/admin/sponsor/orders', { items: null, meta: meta(0) })
      .on('get', '/admin/sponsor/stats', stats)
    await loadSponsors(fake.api, { status: 'REFUND', page: 3 }, 20)
    expect(queryOf(fake.requests, '/admin/sponsor/orders')).toEqual({
      page: '3',
      pageSize: '20',
      status: 'REFUND',
    })
  })
})

describe('changeOrder', () => {
  it('overrides the status of an order', async () => {
    const fake = fakeApi().on('patch', '/admin/sponsor/orders/{id}/status', undefined)
    await changeOrder(fake.api, { action: 'status', id: 4, status: 'DONE' })
    expect(sent(fake.requests)).toEqual(['PATCH /admin/sponsor/orders/4/status'])
    await expect(fake.requests[0]?.json()).resolves.toEqual({ status: 'DONE' })
  })

  it('deletes an order', async () => {
    const fake = fakeApi().on('delete', '/admin/sponsor/orders/{id}', undefined)
    await changeOrder(fake.api, { action: 'remove', id: 4 })
    expect(sent(fake.requests)).toEqual(['DELETE /admin/sponsor/orders/4'])
  })
})

import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter } from './admin-walkthrough'
import { changeWalkthrough, loadWalkthroughs } from './admin-walkthrough.use-cases'

const meta = { currentPage: 1, itemCount: 0, itemsPerPage: 20, totalItems: 435, totalPages: 22 }

const filter: Filter = {
  status: 'ALL',
  query: '',
  author: undefined,
  sort: 'updated',
  page: 1,
  opened: undefined,
}

const listed = () => fakeApi().on('get', '/admin/walkthroughs', { items: null, meta })

const queryOf = (requests: Request[]) =>
  Object.fromEntries(new URL(requests[0]?.url ?? '').searchParams)

describe('loadWalkthroughs', () => {
  it('asks for one page of everything, the latest update first', async () => {
    const fake = listed()
    const listing = await loadWalkthroughs(fake.api, filter, 20)
    expect(listing).toMatchObject({ walkthroughs: [], total: 435, opened: undefined })
    expect(queryOf(fake.requests)).toEqual({
      page: '1',
      pageSize: '20',
      sortBy: 'updated',
      sortOrder: 'desc',
    })
  })

  it('asks for what waits by its flag and for a status by its name', async () => {
    const held = listed()
    await loadWalkthroughs(held.api, { ...filter, status: 'HELD' }, 20)
    expect(queryOf(held.requests)).toMatchObject({ held: 'true' })
    expect(queryOf(held.requests)).not.toHaveProperty('status')
    const hidden = listed()
    await loadWalkthroughs(
      hidden.api,
      { ...filter, status: 'HIDDEN', query: 'route', author: 7 },
      20,
    )
    expect(queryOf(hidden.requests)).toMatchObject({
      status: 'HIDDEN',
      search: 'route',
      creatorId: '7',
    })
  })

  it('opens nothing when the walkthrough is gone', async () => {
    const fake = listed().fail('get', '/admin/walkthroughs/{id}', 404, {
      code: 560101,
      message: 'gone',
    })
    await expect(loadWalkthroughs(fake.api, { ...filter, opened: 8 }, 20)).resolves.toMatchObject({
      opened: undefined,
    })
  })
})

describe('changeWalkthrough', () => {
  it('sets a status or asks for another review', async () => {
    const fake = fakeApi()
      .on('patch', '/admin/walkthroughs/{id}/status', undefined)
      .on('post', '/admin/walkthroughs/{id}/rescan', undefined)
    await changeWalkthrough(fake.api, { action: 'status', id: 8, status: 'HIDDEN' })
    await changeWalkthrough(fake.api, { action: 'rescan', id: 8 })
    expect(fake.requests.map(request => [request.method, new URL(request.url).pathname])).toEqual([
      ['PATCH', '/admin/walkthroughs/8/status'],
      ['POST', '/admin/walkthroughs/8/rescan'],
    ])
    await expect(fake.requests[0]?.json()).resolves.toEqual({ status: 'HIDDEN' })
  })
})

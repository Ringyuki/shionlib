import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadFeed } from './activity.use-cases'

const page: ApiData<'/activity/list', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 30,
    totalItems: 61,
    totalPages: 3,
    content_limit: 0,
  },
}

describe('loadFeed', () => {
  it('asks for a page of one kind of happening', async () => {
    const fake = fakeApi().on('get', '/activity/list', page)
    await expect(loadFeed(fake.api, 'resources', 2)).resolves.toEqual({
      kind: 'resources',
      page: 2,
      happenings: [],
      total: 61,
    })
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '2',
      pageSize: '30',
      category: 'files',
    })
  })

  it('asks for everything when no kind is chosen', async () => {
    const fake = fakeApi().on('get', '/activity/list', page)
    await loadFeed(fake.api, 'all', 1)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.has('category')).toBe(false)
  })
})

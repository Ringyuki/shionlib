import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadReleases } from './release.use-cases'

const now = new Date('2026-10-08T12:00:00Z')

const page = (totalPages: number, totalItems: number): ApiData<'/game/list', 'get'> => ({
  items: null,
  meta: {
    currentPage: 1,
    itemCount: 0,
    itemsPerPage: 100,
    totalItems,
    totalPages,
    content_limit: 0,
  },
})

describe('loadReleases', () => {
  it('asks for every game of the month in release order, also those without resources', async () => {
    const fake = fakeApi().on('get', '/game/list', page(1, 0))
    await expect(loadReleases(fake.api, { year: 2025, month: 4 }, undefined, now)).resolves.toEqual(
      { month: { year: 2025, month: 4 }, current: false, resources: undefined, days: [], total: 0 },
    )
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '1',
      pageSize: '100',
      resources: 'any',
      'filter[start_date]': '2025-04-01',
      'filter[end_date]': '2025-04-30',
      'filter[sort_by]': 'release_date',
      'filter[sort_order]': 'asc',
    })
  })

  it('keeps to games with resources on request and knows the current month', async () => {
    const fake = fakeApi().on('get', '/game/list', page(1, 0))
    const releases = await loadReleases(fake.api, { year: 2026, month: 10 }, 'required', now)
    expect(releases.current).toBe(true)
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('resources')).toBe('required')
  })

  it('reads the following pages of a month with many releases', async () => {
    const fake = fakeApi().on('get', '/game/list', page(3, 250))
    const releases = await loadReleases(fake.api, { year: 2015, month: 12 }, undefined, now)
    expect(fake.requests.map(request => new URL(request.url).searchParams.get('page'))).toEqual([
      '1',
      '2',
      '3',
    ])
    expect(releases.total).toBe(250)
  })
})

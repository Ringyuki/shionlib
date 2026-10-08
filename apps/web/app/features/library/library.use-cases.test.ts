import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { firstAddress } from './library'
import { loadLibrary, searchTags } from './library.use-cases'

const listed: ApiData<'/game/list', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 36,
    totalItems: 40,
    totalPages: 2,
    content_limit: 0,
  },
}

describe('loadLibrary', () => {
  it('asks for the page of the address and returns what the page shows', async () => {
    const fake = fakeApi().on('get', '/game/list', listed)
    const address = {
      ...firstAddress,
      tags: ['纯爱', 'school'],
      platforms: ['win' as const],
      years: [2024],
      resources: 'any' as const,
      page: 2,
    }
    await expect(loadLibrary(fake.api, address, [2025, 2024])).resolves.toEqual({
      address,
      games: [],
      total: 40,
      years: [2025, 2024],
    })
    const sent = new URL(fake.requests[0]?.url ?? '').searchParams
    expect(sent.getAll('filter[tags][]')).toEqual(['纯爱', 'school'])
    expect(sent.getAll('filter[platforms][]')).toEqual(['win'])
    expect(sent.getAll('filter[years][]')).toEqual(['2024'])
    expect(sent.has('filter[exclude_tags][]')).toBe(false)
    expect(sent.get('filter[sort_by]')).toBe('release_date')
    expect(sent.get('filter[sort_order]')).toBe('desc')
    expect(sent.get('resources')).toBe('any')
    expect(sent.get('page')).toBe('2')
    expect(sent.get('pageSize')).toBe('36')
  })

  it('lets a failed list fail the page', async () => {
    const fake = fakeApi().fail('get', '/game/list', 500, { code: 500, message: 'failed' })
    await expect(loadLibrary(fake.api, firstAddress, [])).rejects.toMatchObject({ status: 500 })
  })
})

describe('searchTags', () => {
  it('returns the names with their game counts', async () => {
    const fake = fakeApi().on('get', '/tags', [
      { id: 18, name: '纯爱', display_name: '纯爱', count: 1786, aliases: null },
    ])
    await expect(searchTags(fake.api, ' 纯 ')).resolves.toEqual([{ name: '纯爱', count: 1786 }])
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      q: '纯',
      limit: '12',
    })
  })
})

import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData, Schema } from '~/shared/api/types'
import { firstListing, type Listing } from './uploader'
import { loadUploader } from './uploader.use-cases'

const allowance: Schema<'AllowanceDTO'> = {
  tier: 'new',
  approved: 1,
  trusted: false,
  frozen_until: null,
  stored: 40,
  stored_limit: 100,
  in_flight: 0,
  in_flight_limit: 50,
  max_file_size: 30,
}

const summary: Schema<'DownloadOwnSummaryDTO'> = {
  processing: 2,
  published: 21,
  downloads: 340,
  games: 19,
  files: 30,
  recent: 4,
  recent_days: 30,
}

const listed: ApiData<'/game/download-source/mine', 'get'> = {
  items: null,
  meta: { currentPage: 2, itemCount: 0, itemsPerPage: 20, totalItems: 23, totalPages: 2 },
}

const signedIn = () =>
  fakeApi()
    .on('get', '/composition/mine', null)
    .on('get', '/uploads/quota', allowance)
    .on('get', '/game/download-source/mine/summary', summary)
    .on('get', '/game/download-source/mine', listed)

const listQuery = (requests: readonly Request[]) =>
  requests
    .map(request => new URL(request.url))
    .filter(url => url.pathname === '/game/download-source/mine')
    .map(url => Object.fromEntries(url.searchParams))

describe('loadUploader', () => {
  it('loads the allowance, the totals and the listed page of resources', async () => {
    const fake = signedIn()
    const listing: Listing = { ...firstListing, page: 2 }
    await expect(loadUploader(fake.api, listing)).resolves.toEqual({
      allowance,
      summary,
      listing,
      resources: [],
      compositions: [],
      total: 23,
    })
    expect(listQuery(fake.requests)).toEqual([
      { scope: 'all', sort_by: 'updated', sort_order: 'desc', page: '2', pageSize: '20' },
    ])
  })

  it('passes the stage, the search and the order on', async () => {
    const fake = signedIn()
    await loadUploader(fake.api, {
      stage: 'processing',
      search: 'sakura',
      sort: 'downloads',
      ascending: true,
      page: 1,
    })
    expect(listQuery(fake.requests)).toEqual([
      {
        scope: 'processing',
        q: 'sakura',
        sort_by: 'downloads',
        sort_order: 'asc',
        page: '1',
        pageSize: '20',
      },
    ])
  })

  it('asks for no resources while only what is uploading is shown', async () => {
    const fake = signedIn()
    const listing: Listing = { ...firstListing, stage: 'uploading' }
    await expect(loadUploader(fake.api, listing)).resolves.toEqual({
      allowance,
      summary,
      listing,
      resources: [],
      compositions: [],
      total: 0,
    })
    expect(listQuery(fake.requests)).toEqual([])
  })

  it('has nothing for a guest and asks for nothing more', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 401, { code: 200101, message: 'sign in' })
    await expect(loadUploader(fake.api, firstListing)).resolves.toBeNull()
    expect(fake.requests).toHaveLength(1)
  })

  it('lets other failures through', async () => {
    const fake = fakeApi().fail('get', '/uploads/quota', 500, { code: 500, message: 'failed' })
    await expect(loadUploader(fake.api, firstListing)).rejects.toMatchObject({ status: 500 })
  })
})

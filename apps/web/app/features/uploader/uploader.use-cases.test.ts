import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData, Schema } from '~/shared/api/types'
import { composition } from '../resource/resource-composition-testing'
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

const game: Schema<'GameHeaderDTO'> = {
  id: 10,
  v_id: null,
  b_id: null,
  h_id: 1748,
  extra_info: [],
  title_jp: 'アマカノ～Second Season～',
  title_zh: '甜蜜女友～Second Season～',
  title_en: '',
  aliases: [],
  covers: null,
  developers: [],
  release_date: null,
  release_date_tba: false,
  type: null,
  platform: ['win'],
  content_limit: 0,
}

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
      drafts: [],
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
      drafts: [],
      total: 0,
    })
    expect(listQuery(fake.requests)).toEqual([])
  })

  it('brings the game of each composition that has not started', async () => {
    const draft = composition({ id: 7, game_id: 10, state: 'draft', resource_id: null })
    const queued = composition({ id: 9, game_id: 10, state: 'queued', resource_id: 40 })
    const fake = fakeApi()
      .on('get', '/composition/mine', [draft, queued])
      .on('get', '/game/{id}/header', game)
      .on('get', '/uploads/quota', allowance)
      .on('get', '/game/download-source/mine/summary', summary)
    const content = await loadUploader(fake.api, { ...firstListing, stage: 'uploading' })
    expect(content?.compositions).toEqual([draft, queued])
    expect(content?.drafts).toEqual([{ composition: draft, game }])
  })

  it('keeps a draft whose game is gone', async () => {
    const draft = composition({ id: 7, game_id: 404, state: 'draft', resource_id: null })
    const fake = fakeApi()
      .on('get', '/composition/mine', [draft])
      .on('get', '/uploads/quota', allowance)
      .on('get', '/game/download-source/mine/summary', summary)
    const content = await loadUploader(fake.api, { ...firstListing, stage: 'uploading' })
    expect(content?.drafts).toEqual([{ composition: draft, game: null }])
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

import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Authorization, Source } from './admin-catalog'
import { changeCatalog, loadCatalog, searchSource } from './admin-catalog.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 10,
  totalItems,
  totalPages: 1,
})

const source: Source = {
  name: 'hikarinagi',
  incremental: true,
  games: 24430,
  developers: 7065,
  characters: 120477,
  cursor: '135875',
  pulled_at: '2026-10-12T11:00:00.000Z',
  changes: 14,
  failed_at: null,
  last_error: null,
  refresh_seconds: 604800,
}

const bangumi: Authorization = {
  configured: false,
  authorized: false,
  expires_at: null,
  callback_url: 'https://shionlib.com/api/admin/bangumi/authorization/callback',
}

const queryOf = (request: Request | undefined) =>
  Object.fromEntries(new URL(request?.url ?? '').searchParams)

describe('loadCatalog', () => {
  it('loads the sources, one page of what is kept out and the Bangumi authorization', async () => {
    const fake = fakeApi()
      .on('get', '/admin/catalog/sources', [source])
      .on('get', '/admin/catalog/excluded', { items: null, meta: meta(12) })
      .on('get', '/admin/bangumi/authorization', bangumi)
    await expect(loadCatalog(fake.api, 2)).resolves.toEqual({
      sources: [source],
      excluded: [],
      excludedTotal: 12,
      page: 2,
      bangumi,
    })
    const excluded = fake.requests.find(request => request.url.includes('/excluded'))
    expect(queryOf(excluded)).toEqual({ page: '2', pageSize: '10' })
  })
})

describe('searchSource', () => {
  it('asks the source for the first hits and keeps what was asked', async () => {
    const fake = fakeApi().on('get', '/admin/catalog/search', { items: null, meta: meta(31) })
    const lookup = { source: 'hikarinagi', entity: 'game', query: 'サクラノ刻' } as const
    await expect(searchSource(fake.api, lookup)).resolves.toEqual({ lookup, hits: [], total: 31 })
    expect(queryOf(fake.requests[0])).toEqual({
      source: 'hikarinagi',
      entity: 'game',
      q: 'サクラノ刻',
      page: '1',
      pageSize: '10',
    })
  })
})

describe('changeCatalog', () => {
  it('pulls the changes of a source and tells how many were applied', async () => {
    const fake = fakeApi().on('post', '/admin/catalog/sources/{source}/sync', {
      ...source,
      changes: 3,
    })
    await expect(
      changeCatalog(fake.api, { action: 'sync', source: 'hikarinagi' }),
    ).resolves.toEqual({ kind: 'synced', changes: 3 })
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe(
      '/admin/catalog/sources/hikarinagi/sync',
    )
  })

  it('imports an entry by its number at the source', async () => {
    const fake = fakeApi().on('post', '/admin/catalog/import', { id: 21004 })
    await expect(
      changeCatalog(fake.api, {
        action: 'import',
        source: 'hikarinagi',
        entity: 'developer',
        externalId: '77',
      }),
    ).resolves.toEqual({ kind: 'imported', id: 21004 })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      source: 'hikarinagi',
      entity: 'developer',
      external_id: '77',
    })
  })
})

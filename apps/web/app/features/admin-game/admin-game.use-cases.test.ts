import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter } from './admin-game'
import { changeGame, loadGames } from './admin-game.use-cases'

const meta = (totalItems: number) => ({
  currentPage: 1,
  itemCount: 0,
  itemsPerPage: 20,
  totalItems,
  totalPages: 1,
})

const filter: Filter = { query: '', status: undefined, sort: 'views', page: 1 }

const sent = (requests: Request[]) =>
  requests.map(request => `${request.method} ${new URL(request.url).pathname}`)

describe('loadGames', () => {
  it('asks for one page of every game, most viewed first', async () => {
    const fake = fakeApi().on('get', '/admin/content/games', { items: null, meta: meta(24430) })
    const listing = await loadGames(fake.api, filter, 20)
    expect(listing).toEqual({ filter, games: [], total: 24430 })
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '1',
      pageSize: '20',
      sortBy: 'views',
      sortOrder: 'desc',
    })
  })

  it('passes the search and the status on', async () => {
    const fake = fakeApi().on('get', '/admin/content/games', { items: null, meta: meta(0) })
    await loadGames(fake.api, { query: '590', status: 2, sort: 'updated', page: 2 }, 20)
    expect(Object.fromEntries(new URL(fake.requests[0]?.url ?? '').searchParams)).toEqual({
      page: '2',
      pageSize: '20',
      sortBy: 'updated',
      sortOrder: 'desc',
      search: '590',
      status: '2',
    })
  })
})

describe('changeGame', () => {
  it('hides and shows a game through its status', async () => {
    const fake = fakeApi().on('patch', '/admin/content/games/{id}/status', undefined)
    await changeGame(fake.api, { action: 'status', id: 4, status: 2 })
    expect(sent(fake.requests)).toEqual(['PATCH /admin/content/games/4/status'])
    await expect(fake.requests[0]?.json()).resolves.toEqual({ status: 2 })
  })

  it('adds a game to the recent updates and takes it off', async () => {
    const fake = fakeApi()
      .on('put', '/admin/content/games/{id}/recent-update', undefined)
      .on('delete', '/admin/content/games/{id}/recent-update', undefined)
    await changeGame(fake.api, { action: 'recent', id: 4, marked: true })
    await changeGame(fake.api, { action: 'recent', id: 4, marked: false })
    expect(sent(fake.requests)).toEqual([
      'PUT /admin/content/games/4/recent-update',
      'DELETE /admin/content/games/4/recent-update',
    ])
  })

  it('refreshes a game by importing its entry again', async () => {
    const fake = fakeApi().on('post', '/admin/catalog/import', { id: 4 })
    await changeGame(fake.api, {
      action: 'refresh',
      id: 4,
      source: 'hikarinagi',
      externalId: '18342',
    })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      source: 'hikarinagi',
      entity: 'game',
      external_id: '18342',
    })
  })

  it('removes a game', async () => {
    const fake = fakeApi().on('delete', '/admin/content/games/{id}', undefined)
    await changeGame(fake.api, { action: 'remove', id: 4 })
    expect(sent(fake.requests)).toEqual(['DELETE /admin/content/games/4'])
  })
})

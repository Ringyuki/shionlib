import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { emptyResults } from './search'
import { loadPalette, recordSearch, searchGames } from './search.use-cases'

const results = {
  ...emptyResults(),
  games: { items: [], total: 12 },
}

describe('loadPalette', () => {
  it('offers trending keywords for an empty query', async () => {
    const fake = fakeApi().on('get', '/search/trending', [{ query: 'sakura', score: 3 }])
    await expect(loadPalette(fake.api, '  ')).resolves.toEqual({
      query: '',
      suggestions: [],
      trending: ['sakura'],
      results: null,
      unavailable: false,
    })
  })

  it('asks for every kind and drops the suggestion equal to the query', async () => {
    const fake = fakeApi()
      .on('get', '/search/suggest', ['サクラノ詩', 'サクラノ刻'])
      .on('get', '/search', results)
    const palette = await loadPalette(fake.api, ' サクラノ詩 ')
    expect(palette).toMatchObject({
      query: 'サクラノ詩',
      suggestions: ['サクラノ刻'],
      unavailable: false,
    })
    const search = fake.requests
      .map(request => new URL(request.url))
      .find(url => url.pathname === '/search')
    expect(search?.searchParams.getAll('types')).toEqual(['game', 'developer', 'character'])
    expect(search?.searchParams.get('pageSize')).toBe('5')
  })

  it('reports an unavailable source but keeps the suggestions', async () => {
    const fake = fakeApi()
      .on('get', '/search/suggest', ['サクラノ詩'])
      .fail('get', '/search', 502, { code: 620101, message: 'down' })
    await expect(loadPalette(fake.api, 'サクラ')).resolves.toMatchObject({
      suggestions: ['サクラノ詩'],
      unavailable: true,
    })
  })
})

describe('searchGames', () => {
  it('records the keyword on the first page only', async () => {
    const first = fakeApi().on('get', '/search', results).on('post', '/search/record', undefined)
    await expect(searchGames(first.api, 'sakura', 1, false)).resolves.toMatchObject({
      query: 'sakura',
      games: { total: 12 },
    })
    expect(first.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/search',
      '/search/record',
    ])
    const second = fakeApi().on('get', '/search', results)
    await searchGames(second.api, 'sakura', 2, false)
    expect(second.requests).toHaveLength(1)
  })

  it('asks for games without resources only on request', async () => {
    const flag = async (everyGame: boolean) => {
      const fake = fakeApi().on('get', '/search', results).on('post', '/search/record', undefined)
      await searchGames(fake.api, 'sakura', 1, everyGame)
      return new URL(fake.requests[0]?.url ?? '').searchParams.get('include_without_resources')
    }
    await expect(flag(false)).resolves.toBe('false')
    await expect(flag(true)).resolves.toBe('true')
  })

  it('offers trending keywords instead of asking the source for an empty query', async () => {
    const fake = fakeApi().on('get', '/search/trending', [{ query: 'sakura', score: 3 }])
    await expect(searchGames(fake.api, ' ', 1, false)).resolves.toMatchObject({
      query: '',
      trending: ['sakura'],
      unavailable: false,
    })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/search/trending',
    ])
  })
})

describe('recordSearch', () => {
  it('ignores blank keywords', async () => {
    const fake = fakeApi()
    await recordSearch(fake.api, '  ')
    expect(fake.requests).toHaveLength(0)
  })
})

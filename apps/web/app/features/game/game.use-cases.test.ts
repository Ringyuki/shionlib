import { describe, expect, it } from 'vitest'
import { createApi } from '~/shared/api/client'
import { fakeApi } from '~/shared/api/testing'
import { loadLatestGames, loadScores } from './game.use-cases'

describe('loadLatestGames', () => {
  it('requests one page of the given size', async () => {
    const fake = fakeApi().on('get', '/game/list', {
      items: null,
      meta: {
        content_limit: 0,
        currentPage: 1,
        itemCount: 0,
        itemsPerPage: 6,
        totalItems: 0,
        totalPages: 0,
      },
    })
    await expect(loadLatestGames(fake.api, 6)).resolves.toEqual([])
    expect(new URL(fake.requests[0]?.url ?? '').searchParams.get('pageSize')).toBe('6')
  })
})

describe('loadScores', () => {
  const game = { id: 7, b_id: '611546', v_id: 'v60663' }

  it('keeps the scores that load when another source fails', async () => {
    const fake = fakeApi()
      .fail('get', '/game/score/bangumi/{id}', 500, { code: 500, message: 'failed' })
      .on('get', '/game/score/vndb/{id}', {
        id: 'v60663',
        rating: 82.4,
        average: 82.4,
        votecount: 502,
      })
    await expect(loadScores(fake.api, game)).resolves.toEqual({
      bangumi: undefined,
      vndb: { value: 8.24, votes: 502 },
    })
  })

  it('resolves without scores when the request itself throws', async () => {
    const api = createApi({
      baseUrl: 'http://api.test',
      fetch: () => Promise.reject(new TypeError('fetch failed')),
    })
    await expect(loadScores(api, game)).resolves.toEqual({ bangumi: undefined, vndb: undefined })
  })

  it('asks only the sources the game is linked to', async () => {
    const fake = fakeApi()
    await loadScores(fake.api, { id: 7, b_id: null, v_id: '' })
    expect(fake.requests).toEqual([])
  })
})

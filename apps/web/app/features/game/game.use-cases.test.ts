import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { loadLatestGames } from './game.use-cases'

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

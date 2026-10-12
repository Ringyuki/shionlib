import { describe, expect, it } from 'vitest'
import { parseOptional } from '~/shared/form/check'
import { filterFrom, gameCommand } from './admin-game.schema'

describe('filterFrom', () => {
  it('reads the search, the status and the order', () => {
    expect(filterFrom(new URLSearchParams('q=%20590%20&status=2&sort=downloads'), 3)).toEqual({
      query: '590',
      status: 2,
      sort: 'downloads',
      page: 3,
    })
  })

  it('falls back to every game, most viewed first', () => {
    expect(filterFrom(new URLSearchParams('status=7&sort=random'), 1)).toEqual({
      query: '',
      status: undefined,
      sort: 'views',
      page: 1,
    })
  })
})

describe('gameCommand', () => {
  it('reads a change by its action', () => {
    const refresh = { action: 'refresh', id: 4, source: 'hikarinagi', externalId: '18342' }
    expect(parseOptional(gameCommand, refresh)).toEqual(refresh)
    expect(parseOptional(gameCommand, { action: 'status', id: 4, status: 2 })).toEqual({
      action: 'status',
      id: 4,
      status: 2,
    })
    expect(parseOptional(gameCommand, { action: 'recent', id: 4, marked: false })).toEqual({
      action: 'recent',
      id: 4,
      marked: false,
    })
  })

  it('refuses unknown statuses, ids and actions', () => {
    expect(parseOptional(gameCommand, { action: 'status', id: 4, status: 3 })).toBeUndefined()
    expect(parseOptional(gameCommand, { action: 'remove', id: 0 })).toBeUndefined()
    expect(parseOptional(gameCommand, { action: 'merge', id: 4 })).toBeUndefined()
  })
})

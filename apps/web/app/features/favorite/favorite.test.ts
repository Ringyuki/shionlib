import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { isInAnyList, parseMembershipChange } from './favorite'

const list = (id: number, isFavorite?: boolean): Schema<'FavoriteSummaryDTO'> => ({
  default: id === 1,
  description: null,
  game_count: 0,
  id,
  is_favorite: isFavorite,
  is_private: false,
  name: `list ${id}`,
})

describe('isInAnyList', () => {
  it('is true when one list contains the game', () => {
    expect(isInAnyList([list(1, false), list(2, true)])).toBe(true)
    expect(isInAnyList([list(1)])).toBe(false)
  })
})

describe('parseMembershipChange', () => {
  it('accepts a complete change', () => {
    expect(parseMembershipChange({ listId: 2, gameId: 9, included: true })).toEqual({
      listId: 2,
      gameId: 9,
      included: true,
    })
  })

  it('rejects malformed input', () => {
    expect(parseMembershipChange({ listId: '2', gameId: 9, included: true })).toBeUndefined()
    expect(parseMembershipChange({ listId: 2, gameId: 0, included: true })).toBeUndefined()
    expect(parseMembershipChange(null)).toBeUndefined()
  })
})

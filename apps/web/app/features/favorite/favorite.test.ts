import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { isInAnyList, shownGameCount } from './favorite'

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

describe('shownGameCount', () => {
  it('follows a pending change of membership', () => {
    const saved = { ...list(2, true), game_count: 5 }
    expect(shownGameCount(saved, true)).toBe(5)
    expect(shownGameCount(saved, false)).toBe(4)
    expect(shownGameCount({ ...saved, is_favorite: false }, true)).toBe(6)
  })
})

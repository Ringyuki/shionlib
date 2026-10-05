import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { isInAnyList } from './favorite'

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

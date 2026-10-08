import { describe, expect, it } from 'vitest'
import type { Schema } from '~/shared/api/types'
import { chosenList, favoritesPath, isInAnyList, listLabel, shownGameCount } from './favorite'

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

describe('favorites page', () => {
  it('addresses the lists of a user and one list among them', () => {
    expect(favoritesPath('zh', 3)).toBe('/zh/user/3/favorites')
    expect(favoritesPath('ja', 3, 8)).toBe('/ja/user/3/favorites/8')
  })

  it('opens the named list, or the default one when none is named', () => {
    const lists = [list(4), list(1)]
    expect(chosenList(lists, 4)?.id).toBe(4)
    expect(chosenList(lists, undefined)?.id).toBe(1)
    expect(chosenList([list(4), list(5)], undefined)?.id).toBe(4)
    expect(chosenList(lists, 9)).toBeUndefined()
    expect(chosenList([], undefined)).toBeUndefined()
  })

  it('names the default list in the language of the page', () => {
    expect(listLabel(list(1), '默认收藏夹')).toBe('默认收藏夹')
    expect(listLabel(list(2), '默认收藏夹')).toBe('list 2')
  })
})

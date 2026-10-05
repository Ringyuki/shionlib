import type { Schema } from '~/shared/api/types'

type FavoriteList = Schema<'FavoriteSummaryDTO'>

export function isInAnyList(lists: readonly FavoriteList[]): boolean {
  return lists.some(list => list.is_favorite === true)
}

export function shownGameCount(list: FavoriteList, included: boolean): number {
  const was = list.is_favorite === true
  return list.game_count + (included === was ? 0 : included ? 1 : -1)
}

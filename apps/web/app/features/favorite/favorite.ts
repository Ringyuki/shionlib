import type { Schema } from '~/shared/api/types'

type FavoriteList = Schema<'FavoriteSummaryDTO'>

export function isInAnyList(lists: readonly FavoriteList[]): boolean {
  return lists.some(list => list.is_favorite === true)
}

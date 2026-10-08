import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type FavoriteList = Schema<'FavoriteSummaryDTO'>

export type FavoriteItem = Schema<'FavoriteItemDTO'>

export type Favorites = {
  owner: number
  lists: FavoriteList[]
  selected: FavoriteList | undefined
  items: FavoriteItem[]
  total: number
  page: number
}

export const itemsPageSize = 20

export function isInAnyList(lists: readonly FavoriteList[]): boolean {
  return lists.some(list => list.is_favorite === true)
}

export function shownGameCount(list: FavoriteList, included: boolean): number {
  const was = list.is_favorite === true
  return list.game_count + (included === was ? 0 : included ? 1 : -1)
}

export function favoritesPath(locale: Locale, userId: number, listId?: number): string {
  const base = `/${locale}/user/${userId}/favorites`
  return listId === undefined ? base : `${base}/${listId}`
}

export function chosenList(
  lists: readonly FavoriteList[],
  listId: number | undefined,
): FavoriteList | undefined {
  if (listId !== undefined) {
    return lists.find(list => list.id === listId)
  }
  return lists.find(list => list.default) ?? lists[0]
}

export function listLabel(list: Pick<FavoriteList, 'default' | 'name'>, defaultLabel: string) {
  return list.default ? defaultLabel : list.name
}

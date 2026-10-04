import type { Schema } from '~/shared/api/types'

type FavoriteList = Schema<'FavoriteSummaryDTO'>

export type MembershipChange = {
  listId: number
  gameId: number
  included: boolean
}

export function isInAnyList(lists: readonly FavoriteList[]): boolean {
  return lists.some(list => list.is_favorite === true)
}

export function parseMembershipChange(value: unknown): MembershipChange | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const { listId, gameId, included } = Object.fromEntries(Object.entries(value))
  if (isId(listId) && isId(gameId) && typeof included === 'boolean') {
    return { listId, gameId, included }
  }
  return undefined
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

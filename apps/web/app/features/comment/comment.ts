import { gamePath } from '~/features/game'
import { resourcePath } from '~/features/resource'
import type { Viewer } from '~/features/viewer'
import type { ApiQuery, Schema } from '~/shared/api/types'
import { pageKey, searchAtPage } from '~/shared/http/paging'
import type { Locale } from '~/shared/i18n/locale'

export type CommentItem = Schema<'CommentItemDTO'>

export type CommentThread = Schema<'CommentThreadDTO'>

export type UserComment = Schema<'UserCommentDTO'>

export type Writer = Pick<Viewer, 'id' | 'name' | 'avatar' | 'role'>

export type CommentPlace = { kind: 'game' | 'resource'; id: number }

export type PinRights = { pin: boolean; unpin: boolean }

export type ThreadOrder = NonNullable<ApiQuery<'/comment/game/{game_id}', 'get'>['order']>

export type Comments = {
  place: CommentPlace
  pinned: number | undefined
  threads: CommentThread[]
  total: number
  count: number
  page: number
  order: ThreadOrder
}

export type UserComments = { items: UserComment[]; total: number; page: number }

export type LikeFlip = { from: boolean }

export const threadOrders = ['newest', 'oldest'] as const satisfies readonly ThreadOrder[]

export const firstOrder: ThreadOrder = 'newest'

export const pageSize = 20

export const userPageSize = 20

export const repliesShownFirst = 3

const pendingStatus = 2

const visibleStatus = 1

const adminRole = 2

const orderKey = 'order'

export const focusKey = 'comment'

export function commentsPath(locale: Locale, gameId: number): string {
  return gamePath(locale, gameId, 'comments')
}

export function commentAnchor(commentId: number): string {
  return `comment-${commentId}`
}

export function searchFocusing(search: string, commentId: number): string {
  const params = new URLSearchParams(search)
  params.delete(pageKey)
  params.set(focusKey, String(commentId))
  return `?${params}`
}

export function commentPath(locale: Locale, gameId: number, commentId: number): string {
  return `${commentsPath(locale, gameId)}${searchFocusing('', commentId)}`
}

export function resourceCommentPath(locale: Locale, resourceId: number, commentId: number): string {
  return `${resourcePath(locale, resourceId, 'comments')}${searchFocusing('', commentId)}`
}

type Placed = Pick<UserComment, 'id'> & {
  game: Pick<UserComment['game'], 'id'>
  resource: Pick<NonNullable<UserComment['resource']>, 'id'> | null
}

export function pathOfComment(locale: Locale, comment: Placed): string {
  return comment.resource === null
    ? commentPath(locale, comment.game.id, comment.id)
    : resourceCommentPath(locale, comment.resource.id, comment.id)
}

export function pinRightsOver(
  comment: Pick<CommentItem, 'parent_id' | 'status' | 'pinned'>,
  place: CommentPlace,
  publisherId: number | undefined,
  writer: Pick<Writer, 'id' | 'role'> | undefined,
): PinRights {
  if (place.kind !== 'resource' || writer === undefined || comment.parent_id !== null) {
    return { pin: false, unpin: false }
  }
  const publisher = writer.id === publisherId
  return {
    pin: publisher && !comment.pinned && comment.status === visibleStatus,
    unpin: comment.pinned && (publisher || writer.role >= adminRole),
  }
}

export function firstLine(text: string): string {
  return text.trim().split('\n', 1)[0] ?? ''
}

export function aimsAt(hash: string, commentId: number): boolean {
  return hash === `#${commentAnchor(commentId)}`
}

export function searchOfFocused(search: string, page: number): string {
  const params = new URLSearchParams(search)
  params.delete(focusKey)
  const kept = params.toString()
  return searchAtPage(kept === '' ? '' : `?${kept}`, page)
}

export function isPending(comment: Pick<CommentItem, 'status'>): boolean {
  return comment.status === pendingStatus
}

export function searchInOrder(search: string, order: ThreadOrder): string {
  const params = new URLSearchParams(search)
  params.delete(pageKey)
  if (order === firstOrder) {
    params.delete(orderKey)
  } else {
    params.set(orderKey, order)
  }
  const kept = params.toString()
  return kept === '' ? '' : `?${kept}`
}

export function likesOf(
  comment: Pick<CommentItem, 'is_liked' | 'like_count'>,
  flip: LikeFlip | undefined,
): { liked: boolean; count: number } {
  const flipped = flip !== undefined && flip.from === comment.is_liked
  if (!flipped) {
    return { liked: comment.is_liked, count: comment.like_count }
  }
  return {
    liked: !comment.is_liked,
    count: Math.max(0, comment.like_count + (comment.is_liked ? -1 : 1)),
  }
}

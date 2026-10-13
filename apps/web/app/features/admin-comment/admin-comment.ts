import { searchSet, type Category } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export type Comment = Schema<'AdminCommentItemDTO'>

export type CommentDetail = Schema<'AdminCommentDetailDTO'>

export const visible = 1

export const pending = 2

export const blocked = 3

export const statuses = [pending, visible, blocked] as const

export type Status = (typeof statuses)[number]

export const everyStatus = 'ALL'

export const statusFilters = [...statuses, everyStatus] as const

export type StatusFilter = (typeof statusFilters)[number]

export const defaultStatus: StatusFilter = pending

export const sorts = ['newest', 'oldest'] as const

export type Sort = (typeof sorts)[number]

export const defaultSort: Sort = 'newest'

export const verdicts = [visible, blocked] as const

export type Verdict = (typeof verdicts)[number]

export type Filter = {
  status: StatusFilter
  query: string
  author: number | undefined
  sort: Sort
  page: number
  opened: number | undefined
}

export type Narrowing = Omit<Filter, 'page' | 'opened'>

export type AuthorFacts = {
  joined: string
  written: number
  blocked: number
}

export type Opened = {
  detail: CommentDetail
  author: AuthorFacts
}

export const openedKey = 'id'

export const maxQueryLength = 100

export const queryDelay = 350

export const fallbackCategory: Category = 'SPAM'

export function searchOf(filter: Narrowing): string {
  const entries: [string, string | undefined][] = [
    ['status', filter.status === defaultStatus ? undefined : String(filter.status)],
    ['q', filter.query === '' ? undefined : filter.query],
    ['author', filter.author?.toString()],
    ['sort', filter.sort === defaultSort ? undefined : filter.sort],
  ]
  return entries.reduce((search, [key, value]) => searchSet(search, key, value), '')
}

export function searchWith(search: string, opened: number | undefined): string {
  return searchSet(search, openedKey, opened?.toString())
}

export function narrowed(filter: Narrowing): boolean {
  return filter.status !== defaultStatus || filter.query !== '' || filter.author !== undefined
}

export function awaiting(comment: Pick<Comment, 'status'>): boolean {
  return comment.status === pending
}

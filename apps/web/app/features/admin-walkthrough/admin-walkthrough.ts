import { searchSet } from '~/features/admin'
import type { Schema } from '~/shared/api/types'

export type Walkthrough = Schema<'AdminWalkthroughItemDTO'>

export type WalkthroughDetail = Schema<'AdminWalkthroughDetailDTO'>

export type Route = Schema<'WalkthroughRouteDTO'>

export const statuses = ['PUBLISHED', 'HIDDEN', 'DRAFT', 'DELETED'] as const

export type Status = (typeof statuses)[number]

export const everyStatus = 'ALL'

export const heldOnly = 'HELD'

export const statusFilters = [everyStatus, heldOnly, ...statuses] as const

export type StatusFilter = (typeof statusFilters)[number]

export const defaultStatus: StatusFilter = everyStatus

export const sorts = ['updated', 'created'] as const

export type Sort = (typeof sorts)[number]

export const defaultSort: Sort = 'updated'

export const outcomes = ['PUBLISHED', 'HIDDEN', 'DELETED'] as const

export type Outcome = (typeof outcomes)[number]

export type Filter = {
  status: StatusFilter
  query: string
  author: number | undefined
  sort: Sort
  page: number
  opened: number | undefined
}

export type Narrowing = Omit<Filter, 'page' | 'opened'>

export const openedKey = 'id'

export const maxQueryLength = 100

export const queryDelay = 350

export function searchOf(filter: Narrowing): string {
  const entries: [string, string | undefined][] = [
    ['status', filter.status === defaultStatus ? undefined : filter.status],
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

export function stepsOf(route: Pick<Route, 'steps'>): number {
  return (route.steps ?? []).filter(step => step.kind !== 'gap').length
}

export const languages = ['zh', 'en', 'ja'] as const

export type Language = (typeof languages)[number] | 'unknown'

export function languageOf(walkthrough: Pick<Walkthrough, 'lang'>): Language {
  return languages.find(language => language === walkthrough.lang) ?? 'unknown'
}

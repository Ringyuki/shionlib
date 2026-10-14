import type { Schema } from '~/shared/api/types'

export type Summary = Schema<'OpenSummaryDTO'>

export type AdminKey = Schema<'AdminKeyDTO'>

export type KeyDetail = Schema<'AdminKeyDetailDTO'>

export type Day = Schema<'DayDTO'>

export const statuses = ['active', 'suspended'] as const

export type Status = (typeof statuses)[number]

export const sorts = ['requests', 'used', 'created'] as const

export type Sort = (typeof sorts)[number]

export const ranges = ['7', '30', '90'] as const

export type Range = (typeof ranges)[number]

export const rangeDays = { '7': 7, '30': 30, '90': 90 } as const

export const defaultSort: Sort = 'requests'

export const defaultRange: Range = '30'

export const maxQueryLength = 100

export const queryDelay = 300

export const busyThrottled = 100

export const openedKey = 'key'

export type Filter = {
  status: Status | undefined
  query: string
  user: number | undefined
  sort: Sort
  days: Range
  key: number | undefined
  page: number
}

export function searchOf(filter: Omit<Filter, 'page'>): string {
  const search = new URLSearchParams()
  if (filter.status !== undefined) {
    search.set('status', filter.status)
  }
  if (filter.query !== '') {
    search.set('q', filter.query)
  }
  if (filter.user !== undefined) {
    search.set('user', String(filter.user))
  }
  if (filter.sort !== defaultSort) {
    search.set('sort', filter.sort)
  }
  if (filter.days !== defaultRange) {
    search.set('days', filter.days)
  }
  if (filter.key !== undefined) {
    search.set(openedKey, String(filter.key))
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export function busy(key: Pick<AdminKey, 'recent'>): boolean {
  return key.recent.throttled > busyThrottled
}

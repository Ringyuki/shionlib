import {
  requiresResources,
  resourceRuleFor,
  type GameSort,
  type GameSummary,
  type Platform,
  type ResourceRule,
} from '~/features/game'
import type { ApiQuery, Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'
import { siteMonthStart } from '~/shared/i18n/site-time'

export type TagOption = Pick<Schema<'SearchTagDTO'>, 'name' | 'count'>

export type LibraryAddress = {
  tags: string[]
  excluded: string[]
  platforms: Platform[]
  years: number[]
  months: number[]
  sort: GameSort
  ascending: boolean
  resources: ResourceRule | undefined
  page: number
}

export type LibraryContent = {
  address: LibraryAddress
  games: GameSummary[]
  total: number
  years: number[]
}

export type Condition = {
  kind: 'tag' | 'excluded' | 'platform' | 'year' | 'month' | 'resources'
  value: string
  without: Partial<LibraryAddress>
}

export const sortKeys = [
  'release_date',
  'resource_updated',
  'hot_score',
  'views',
  'downloads',
] as const satisfies readonly GameSort[]

export const firstAddress: LibraryAddress = {
  tags: [],
  excluded: [],
  platforms: [],
  years: [],
  months: [],
  sort: 'release_date',
  ascending: false,
  resources: undefined,
  page: 1,
}

export const orders = [
  { name: 'newest', sort: 'release_date', ascending: false },
  { name: 'oldest', sort: 'release_date', ascending: true },
  { name: 'updated', sort: 'resource_updated', ascending: false },
  { name: 'hot', sort: 'hot_score', ascending: false },
  { name: 'views', sort: 'views', ascending: false },
  { name: 'downloads', sort: 'downloads', ascending: false },
] as const satisfies readonly (Pick<LibraryAddress, 'sort' | 'ascending'> & { name: string })[]

export type Order = (typeof orders)[number]

export const pageSize = 36

export const firstYear = 1980

export const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const maxChosen = 20

export const maxTagLength = 100

export const tagOptionSize = 12

export const tagSearchDelay = 250

export function yearOptions(now: Date): number[] {
  const latest = siteMonthStart(now).getUTCFullYear() + 1
  return Array.from({ length: latest - firstYear + 1 }, (_, index) => latest - index)
}

export function reversible(sort: GameSort): boolean {
  return orders.some(order => order.sort === sort && order.ascending)
}

export function orderOf(address: Pick<LibraryAddress, 'sort' | 'ascending'>): Order {
  const sorted = orders.filter(order => order.sort === address.sort)
  return sorted.find(order => order.ascending === address.ascending) ?? sorted[0] ?? orders[0]
}

export function librarySearch(address: LibraryAddress): string {
  const params = new URLSearchParams()
  const add = (key: string, values: readonly (string | number)[]) => {
    for (const value of values) {
      params.append(key, String(value))
    }
  }
  add('tag', address.tags)
  add('exclude', address.excluded)
  add('platform', address.platforms)
  add('year', address.years)
  add('month', address.years.length === 0 ? [] : address.months)
  if (address.sort !== firstAddress.sort) {
    params.set('sort', address.sort)
  }
  if (address.ascending && reversible(address.sort)) {
    params.set('order', 'asc')
  }
  if (address.resources !== undefined) {
    params.set('resources', address.resources)
  }
  if (address.page > 1) {
    params.set('page', String(address.page))
  }
  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

export function libraryPath(locale: Locale, changes: Partial<LibraryAddress> = {}): string {
  return `/${locale}/game${librarySearch({ ...firstAddress, ...changes })}`
}

export function listQuery(address: LibraryAddress): ApiQuery<'/game/list', 'get'> {
  return {
    page: address.page,
    pageSize,
    'filter[tags][]': address.tags,
    'filter[exclude_tags][]': address.excluded,
    'filter[platforms][]': address.platforms,
    'filter[years][]': address.years,
    'filter[months][]': address.years.length === 0 ? [] : address.months,
    'filter[sort_by]': address.sort,
    'filter[sort_order]': address.ascending ? 'asc' : 'desc',
    resources: address.resources,
  }
}

export function listsOnlyDownloadable(address: Pick<LibraryAddress, 'sort'>): boolean {
  return address.sort === 'resource_updated'
}

export function narrowedToResources(address: LibraryAddress, byDefault: boolean): boolean {
  return listsOnlyDownloadable(address) || requiresResources(address.resources, byDefault)
}

export function withResourcesOnly(only: boolean, byDefault: boolean): Partial<LibraryAddress> {
  return { resources: resourceRuleFor(only, byDefault) }
}

export function conditionsOf(address: LibraryAddress, byDefault: boolean): Condition[] {
  const { tags, excluded, platforms, years, months: chosenMonths, resources } = address
  const overridden =
    resources !== undefined && requiresResources(resources, byDefault) !== byDefault
  return [
    ...tags.map((tag): Condition => ({
      kind: 'tag',
      value: tag,
      without: { tags: tags.filter(other => other !== tag) },
    })),
    ...excluded.map((tag): Condition => ({
      kind: 'excluded',
      value: tag,
      without: { excluded: excluded.filter(other => other !== tag) },
    })),
    ...platforms.map((platform): Condition => ({
      kind: 'platform',
      value: platform,
      without: { platforms: platforms.filter(other => other !== platform) },
    })),
    ...years.map((year): Condition => ({
      kind: 'year',
      value: String(year),
      without: { years: years.filter(other => other !== year) },
    })),
    ...(years.length === 0 ? [] : chosenMonths).map((month): Condition => ({
      kind: 'month',
      value: String(month),
      without: { months: chosenMonths.filter(other => other !== month) },
    })),
    ...(overridden && !listsOnlyDownloadable(address)
      ? [{ kind: 'resources', value: resources, without: { resources: undefined } } as const]
      : []),
  ]
}

export function withoutConditions(address: LibraryAddress): LibraryAddress {
  return { ...firstAddress, sort: address.sort, ascending: address.ascending }
}

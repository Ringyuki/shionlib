import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

export type Translator = Schema<'AdminTranslatorItemDTO'>

export type Cluster = Translator[]

export const views = ['all', 'duplicates'] as const

export type View = (typeof views)[number]

export const defaultView: View = 'all'

export const sorts = ['works', 'resources', 'latest', 'name'] as const

export type Sort = (typeof sorts)[number]

export const defaultSort: Sort = 'works'

export type Filter = {
  view: View
  query: string
  sort: Sort
  page: number
}

export const maxQueryLength = 64

export const queryDelay = 300

export const mostAliases = constraints.AdminTranslatorEditInputBody.aliases.maxItems

export function searchOf(filter: Omit<Filter, 'page'>): string {
  const search = new URLSearchParams()
  if (filter.view !== defaultView) {
    search.set('view', filter.view)
  }
  if (filter.query !== '') {
    search.set('q', filter.query)
  }
  if (filter.sort !== defaultSort) {
    search.set('sort', filter.sort)
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export function ascending(sort: Sort): boolean {
  return sort === 'name'
}

export function keptByDefault(cluster: readonly Translator[]): number | null {
  const most = [...cluster].sort((a, b) => b.resources_count - a.resources_count || a.id - b.id)[0]
  return most?.id ?? null
}

export function idsOf(cluster: readonly Translator[]): number[] {
  return cluster.map(translator => translator.id)
}

export function mergedInto(cluster: readonly Translator[], keep: number): number[] {
  return idsOf(cluster).filter(id => id !== keep)
}

export function clusterKey(cluster: readonly Translator[]): string {
  return idsOf(cluster).join('-')
}

import type { Schema } from '~/shared/api/types'
import { languageOptions, platformOptions, type Language, type Resource } from './resource'
import { translationOptions } from './resource-info'

export type MoyuEntry = Schema<'MoyuEntryDTO'>

export type ListKind = 'game' | MoyuEntry['kind']

export type ListSort = 'updated' | 'downloads' | 'smallest' | 'largest'

export type FilterName = 'kind' | 'language' | 'translation' | 'platform'

export type ListFilter = Record<FilterName, readonly string[]>

export type FilterGroup = { name: FilterName; options: string[] }

type Facts = ListFilter & {
  key: string
  downloads: number
  updated: number
  size: number | undefined
}

export type Listed = Facts &
  ({ source: 'site'; resource: Resource } | { source: 'moyu'; entry: MoyuEntry })

export const listSorts: readonly ListSort[] = ['updated', 'downloads', 'smallest', 'largest']

export const noFilter: ListFilter = { kind: [], language: [], translation: [], platform: [] }

export const listToolsFrom = 4

export const moyuSite = 'https://www.moyu.moe'

const siteKind: ListKind = 'game'

const kinds: readonly ListKind[] = [siteKind, 'patch', 'save']

const chinese: readonly Language[] = ['zh', 'zh-hant']

const vocabulary: Record<FilterName, readonly string[]> = {
  kind: kinds,
  language: [...chinese, ...languageOptions.filter(language => !chinese.includes(language))],
  translation: translationOptions.filter(translation => translation !== 'none'),
  platform: platformOptions,
}

const filterNames: readonly FilterName[] = ['kind', 'language', 'translation', 'platform']

function ofSite(resource: Resource): Listed {
  const files = resource.files ?? []
  return {
    source: 'site',
    resource,
    key: `site-${resource.id}`,
    kind: [siteKind],
    language: resource.language ?? [],
    translation:
      resource.translation === null || resource.translation === 'none'
        ? []
        : [resource.translation],
    platform: resource.platform ?? [],
    downloads: resource.downloads,
    updated: Date.parse(resource.updated),
    size: files.length === 0 ? undefined : files.reduce((total, file) => total + file.file_size, 0),
  }
}

function ofMoyu(entry: MoyuEntry): Listed {
  return {
    source: 'moyu',
    entry,
    key: `moyu-${entry.id}`,
    kind: [entry.kind],
    language: entry.language ?? [],
    translation: entry.translation === null ? [] : [entry.translation],
    platform: entry.platform ?? [],
    downloads: entry.downloads,
    updated: Date.parse(entry.updated),
    size: entry.size ?? undefined,
  }
}

export function listOf(resources: readonly Resource[], entries: readonly MoyuEntry[]): Listed[] {
  return [...resources.map(ofSite), ...entries.map(ofMoyu)]
}

export function filterGroups(items: readonly Listed[]): FilterGroup[] {
  return filterNames
    .map(name => ({
      name,
      options: vocabulary[name].filter(option => items.some(item => item[name].includes(option))),
    }))
    .filter(group => group.options.length > 1)
}

export function offered(filter: ListFilter, groups: readonly FilterGroup[]): ListFilter {
  const kept = (name: FilterName) => {
    const options = groups.find(group => group.name === name)?.options ?? []
    return filter[name].filter(value => options.includes(value))
  }
  return {
    kind: kept('kind'),
    language: kept('language'),
    translation: kept('translation'),
    platform: kept('platform'),
  }
}

export function filterCount(filter: ListFilter): number {
  return filterNames.reduce((total, name) => total + filter[name].length, 0)
}

function matches(item: Listed, filter: ListFilter): boolean {
  return filterNames.every(
    name => filter[name].length === 0 || filter[name].some(value => item[name].includes(value)),
  )
}

function rank(item: Listed): number {
  return kinds.findIndex(kind => item.kind.includes(kind))
}

function bySize(a: Listed, b: Listed, direction: 1 | -1): number {
  if (a.size === undefined || b.size === undefined) {
    return Number(a.size === undefined) - Number(b.size === undefined)
  }
  return (a.size - b.size) * direction
}

const orders: Record<ListSort, (a: Listed, b: Listed) => number> = {
  updated: (a, b) => b.updated - a.updated,
  downloads: (a, b) => b.downloads - a.downloads,
  smallest: (a, b) => bySize(a, b, 1),
  largest: (a, b) => bySize(a, b, -1),
}

export function pick(items: readonly Listed[], filter: ListFilter, sort: ListSort): Listed[] {
  return items
    .filter(item => matches(item, filter))
    .sort((a, b) => rank(a) - rank(b) || orders[sort](a, b))
}

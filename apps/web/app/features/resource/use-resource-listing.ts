import { useState } from 'react'
import type { Resource } from './resource'
import {
  filterGroups,
  listOf,
  listToolsFrom,
  noFilter,
  offered,
  pick,
  type ListFilter,
  type ListSort,
  type MoyuEntry,
} from './resource-listing'

export function useResourceListing(resources: readonly Resource[], entries: readonly MoyuEntry[]) {
  const [chosen, setFilter] = useState<ListFilter>(noFilter)
  const [sort, setSort] = useState<ListSort>('updated')
  const items = listOf(resources, entries)
  const tools = items.length >= listToolsFrom
  const groups = tools ? filterGroups(items) : []
  const filter = offered(chosen, groups)
  return {
    total: items.length,
    tools,
    groups,
    filter,
    sort,
    shown: pick(items, filter, sort),
    setFilter,
    setSort,
    reset: () => setFilter(noFilter),
  }
}

import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { normalizeQuery, searchDelayMs } from './search'
import type { gameOptionsLoader, recentReleasesLoader } from './search.server'

export function useGameOptions() {
  const found = useFetcher<typeof gameOptionsLoader>()
  const recent = useFetcher<typeof recentReleasesLoader>()
  const [search, setSearch] = useState('')
  const query = normalizeQuery(search)
  const { load: find } = found
  const { load: loadRecent } = recent
  useEffect(() => {
    void loadRecent(href('/resources/search/releases'))
  }, [loadRecent])
  useEffect(() => {
    if (query === '') {
      return
    }
    const timer = window.setTimeout(
      () => void find(`${href('/resources/search/games')}?${new URLSearchParams({ q: query })}`),
      searchDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [query, find])
  return {
    search,
    setSearch,
    searching: query !== '',
    found: query === '' ? [] : (found.data ?? []),
    recent: recent.data,
    loading: (query === '' ? recent : found).state === 'loading',
  }
}

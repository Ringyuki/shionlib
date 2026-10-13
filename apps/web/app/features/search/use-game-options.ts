import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import { normalizeQuery, searchDelayMs } from './search'
import type { gameOptionsLoader, recentReleasesLoader } from './search.server'

export function useGameOptions() {
  const found = useLazyLoad(useFetcher<typeof gameOptionsLoader>())
  const recent = useLazyLoad(useFetcher<typeof recentReleasesLoader>())
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
    found: query === '' ? [] : (found.result ?? []),
    recent: recent.result,
    loading: (query === '' ? recent : found).loading,
  }
}

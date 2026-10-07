import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { normalizeQuery, searchDelayMs } from './search'
import type { gameOptionsLoader } from './search.server'

export function useGameOptions() {
  const fetcher = useFetcher<typeof gameOptionsLoader>()
  const [search, setSearch] = useState('')
  const query = normalizeQuery(search)
  const load = fetcher.load
  useEffect(() => {
    if (query === '') {
      return
    }
    const timer = window.setTimeout(
      () => void load(`${href('/resources/search/games')}?${new URLSearchParams({ q: query })}`),
      searchDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [query, load])
  const games = query === '' ? [] : (fetcher.data ?? [])
  return { search, setSearch, games, loading: fetcher.state === 'loading' }
}

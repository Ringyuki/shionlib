import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import { tagSearchDelay } from './library'
import type { tagOptionsLoader } from './library.server'

export function useTagOptions() {
  const found = useLazyLoad(useFetcher<typeof tagOptionsLoader>())
  const [search, setSearch] = useState('')
  const [wanted, setWanted] = useState(false)
  const query = search.trim()
  const { load } = found
  useEffect(() => {
    if (!wanted) {
      return
    }
    const timer = window.setTimeout(
      () => void load(`${href('/resources/library/tags')}?${new URLSearchParams({ q: query })}`),
      query === '' ? 0 : tagSearchDelay,
    )
    return () => window.clearTimeout(timer)
  }, [wanted, query, load])
  return {
    search,
    setSearch,
    prepare: () => setWanted(true),
    options: found.result ?? [],
    loading: found.loading,
  }
}

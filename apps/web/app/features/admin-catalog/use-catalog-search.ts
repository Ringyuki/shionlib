import { useEffect, useEffectEvent, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import { searchStateOf, type Lookup } from './admin-catalog'
import type { catalogSearchLoader } from './admin-catalog.server'

const typingDelay = 400

export function useCatalogSearch(lookup: Lookup) {
  const fetched = useLazyLoad(useFetcher<typeof catalogSearchLoader>())
  const [asked, setAsked] = useState<string>()
  const query = lookup.query.trim()
  const search = new URLSearchParams({ source: lookup.source, entity: lookup.entity, q: query })
  const key = search.toString()
  const reload = () => {
    setAsked(key)
    void fetched.load(`${href('/resources/admin/catalog/search')}?${key}`)
  }
  const load = useEffectEvent(reload)
  useEffect(() => {
    if (query === '' || lookup.source === '') {
      return
    }
    const timer = window.setTimeout(load, typingDelay)
    return () => window.clearTimeout(timer)
  }, [key, query, lookup.source])
  const waiting = query !== '' && (asked !== key || fetched.loading)
  const kept = fetched.result
  const shown =
    query !== '' &&
    !fetched.failed &&
    kept?.lookup.source === lookup.source &&
    kept.lookup.entity === lookup.entity
  return {
    found: shown ? kept : undefined,
    state: searchStateOf({ query, waiting, failed: fetched.failed }),
    waiting,
    reload,
  }
}

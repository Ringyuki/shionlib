import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import { cleanName, suggestDelay } from './translator'
import type { translatorOptionsLoader } from './translator.server'

export function useTranslatorOptions() {
  const found = useLazyLoad(useFetcher<typeof translatorOptionsLoader>())
  const [search, setSearch] = useState('')
  const [wanted, setWanted] = useState(false)
  const query = cleanName(search)
  const { load } = found
  useEffect(() => {
    if (!wanted) {
      return
    }
    const timer = window.setTimeout(
      () =>
        void load(`${href('/resources/translator/options')}?${new URLSearchParams({ q: query })}`),
      query === '' ? 0 : suggestDelay,
    )
    return () => window.clearTimeout(timer)
  }, [wanted, query, load])
  return {
    search,
    setSearch,
    prepare: () => setWanted(true),
    found: found.result ?? [],
    loading: found.loading,
  }
}

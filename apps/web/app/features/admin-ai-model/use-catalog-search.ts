import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { aiCatalogModelsLoader } from './admin-ai-model.server'

const typingDelay = 300

export function useCatalogSearch(query: string, wanted: boolean) {
  const found = useLazyLoad(useFetcher<typeof aiCatalogModelsLoader>())
  const search = new URLSearchParams({ q: query.trim() }).toString()
  const load = useEffectEvent(
    () => void found.load(`${href('/resources/admin/ai/catalog/models')}?${search}`),
  )
  useEffect(() => {
    if (!wanted) {
      return
    }
    const timer = window.setTimeout(load, typingDelay)
    return () => window.clearTimeout(timer)
  }, [search, wanted])
  return { models: found.result ?? [], loading: found.loading, loaded: found.result !== undefined }
}

import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { EntryPage, Place, View } from './inspection'
import type { entryPageLoader } from './inspection.server'

function addressOf(view: View, place: Place): string {
  const params = new URLSearchParams({ inspection: String(view.inspectionId) })
  if (place.parent !== null) {
    params.set('parent', String(place.parent))
  }
  params.set('page', String(place.page))
  if (view.query !== '') {
    params.set('q', view.query)
  }
  return `${href('/resources/inspection/entries')}?${params.toString()}`
}

export function useEntryPage(view: View, place: Place, onLoaded: (page: EntryPage) => void) {
  const pages = useLazyLoad(useFetcher<typeof entryPageLoader>())
  const { load, result } = pages
  const address = addressOf(view, place)
  const deliver = useEffectEvent(onLoaded)
  useEffect(() => {
    void load(address)
  }, [load, address])
  useEffect(() => {
    if (result !== undefined) {
      deliver(result)
    }
  }, [result])
  return { failed: pages.failed && !pages.loading, retry: () => void load(address) }
}

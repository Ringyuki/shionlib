import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import { previewDelay, previewable, type NameQuery } from './resource-name'
import type { namePreviewLoader } from './resource.server'

export function useNamePreview(query: NameQuery | undefined) {
  const preview = useLazyLoad(useFetcher<typeof namePreviewLoader>())
  const { load } = preview
  const wanted = query !== undefined && previewable(query) ? JSON.stringify(query) : undefined
  useEffect(() => {
    if (wanted === undefined) {
      return
    }
    const timer = window.setTimeout(
      () => void load(`${href('/resources/resource/name')}?${new URLSearchParams({ q: wanted })}`),
      previewDelay,
    )
    return () => window.clearTimeout(timer)
  }, [wanted, load])
  return wanted === undefined ? undefined : preview.result
}

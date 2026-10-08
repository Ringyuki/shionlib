import { useCallback, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { paletteLoader } from './search.server'

export function usePaletteSource() {
  const palette = useLazyLoad(useFetcher<typeof paletteLoader>())
  const [idle, setIdle] = useState(palette.result)
  const loaded = palette.result
  if (loaded !== undefined && loaded.query === '' && loaded !== idle) {
    setIdle(loaded)
  }
  const fetch = palette.load
  const load = useCallback(
    (query: string) =>
      void fetch(`${href('/resources/search')}?${new URLSearchParams({ q: query })}`),
    [fetch],
  )
  const of = (query: string) => (loaded?.query === query ? loaded : query === '' ? idle : undefined)
  return { load, of, failed: palette.failed && !palette.loading }
}

export type PaletteSource = ReturnType<typeof usePaletteSource>

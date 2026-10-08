import { useCallback, useState } from 'react'
import { href, useFetcher } from 'react-router'
import type { paletteLoader } from './search.server'

export function usePaletteSource() {
  const fetcher = useFetcher<typeof paletteLoader>()
  const [idle, setIdle] = useState(fetcher.data)
  const loaded = fetcher.data
  if (loaded !== undefined && loaded.query === '' && loaded !== idle) {
    setIdle(loaded)
  }
  const fetch = fetcher.load
  const load = useCallback(
    (query: string) =>
      void fetch(`${href('/resources/search')}?${new URLSearchParams({ q: query })}`),
    [fetch],
  )
  const of = (query: string) => (loaded?.query === query ? loaded : query === '' ? idle : undefined)
  return { load, of }
}

export type PaletteSource = ReturnType<typeof usePaletteSource>

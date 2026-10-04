import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import type { artworkLoader } from './auth.server'

export function useArtwork(open: boolean) {
  const fetcher = useFetcher<typeof artworkLoader>()
  const load = fetcher.load
  const loaded = fetcher.data !== undefined || fetcher.state !== 'idle'

  useEffect(() => {
    if (open && !loaded) {
      void load(href('/resources/auth/artwork'))
    }
  }, [open, loaded, load])

  return fetcher.data ?? null
}

import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import type { artworkLoader } from './auth.server'

export function useArtwork(wanted: boolean) {
  const fetcher = useFetcher<typeof artworkLoader>()
  const load = fetcher.load
  const requested = fetcher.data !== undefined || fetcher.state !== 'idle'

  useEffect(() => {
    if (wanted && !requested) {
      void load(href('/resources/auth/artwork'))
    }
  }, [wanted, requested, load])

  return fetcher.data
}

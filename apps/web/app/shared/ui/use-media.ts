import { useSyncExternalStore } from 'react'

export function useMedia(query: string, onServer: boolean): boolean {
  return useSyncExternalStore(
    onChange => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => onServer,
  )
}

export function useNarrow(): boolean {
  return useMedia('(max-width: 639px)', false)
}

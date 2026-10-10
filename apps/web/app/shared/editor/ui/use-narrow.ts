import { useSyncExternalStore } from 'react'

const narrowScreen = '(max-width: 639px)'

function watch(notify: () => void): () => void {
  const query = window.matchMedia(narrowScreen)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

export function useNarrow(): boolean {
  return useSyncExternalStore(
    watch,
    () => window.matchMedia(narrowScreen).matches,
    () => false,
  )
}

import { useCallback } from 'react'
import { href, useFetcher } from 'react-router'
import type { fileHistoryLoader } from './resource.server'

export function useFileHistory(fileId: number) {
  const fetcher = useFetcher<typeof fileHistoryLoader>()
  const { load: fetch } = fetcher
  const load = useCallback(
    () =>
      void fetch(
        `${href('/resources/resource/history')}?${new URLSearchParams({ file: String(fileId) })}`,
      ),
    [fetch, fileId],
  )
  return { history: fetcher.data, loading: fetcher.state !== 'idle', load }
}

import { useCallback } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { fileHistoryLoader } from './resource.server'

export function useFileHistory(fileId: number) {
  const history = useLazyLoad(useFetcher<typeof fileHistoryLoader>())
  const { load: fetch } = history
  const load = useCallback(
    () =>
      void fetch(
        `${href('/resources/resource/history')}?${new URLSearchParams({ file: String(fileId) })}`,
      ),
    [fetch, fileId],
  )
  return { history: history.result, loading: history.loading, load }
}

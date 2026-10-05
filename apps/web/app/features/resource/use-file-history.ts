import { href, useFetcher } from 'react-router'
import type { fileHistoryLoader } from './resource.server'

export function useFileHistory(fileId: number) {
  const fetcher = useFetcher<typeof fileHistoryLoader>()
  const load = () =>
    fetcher.load(
      `${href('/resources/resource/history')}?${new URLSearchParams({ file: String(fileId) })}`,
    )
  return { history: fetcher.data, loading: fetcher.state !== 'idle', load }
}

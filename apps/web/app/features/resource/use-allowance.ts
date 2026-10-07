import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import type { allowanceLoader } from './resource.server'

export function useAllowance() {
  const fetcher = useFetcher<typeof allowanceLoader>()
  const { load } = fetcher
  useEffect(() => {
    void load(href('/resources/upload/allowance'))
  }, [load])
  return fetcher.data ?? undefined
}

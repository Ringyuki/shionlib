import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import type { allowanceLoader } from './resource.server'

export function useAllowance(needed = true) {
  const fetcher = useFetcher<typeof allowanceLoader>()
  const { load } = fetcher
  useEffect(() => {
    if (needed) {
      void load(href('/resources/upload/allowance'))
    }
  }, [needed, load])
  return fetcher.data ?? undefined
}

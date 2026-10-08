import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { allowanceLoader } from './resource.server'

export function useAllowance(needed = true) {
  const allowance = useLazyLoad(useFetcher<typeof allowanceLoader>())
  const { load } = allowance
  useEffect(() => {
    if (needed) {
      void load(href('/resources/upload/allowance'))
    }
  }, [needed, load])
  return allowance.result ?? undefined
}

import { useSyncExternalStore } from 'react'

const never = () => () => undefined

export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  )
}

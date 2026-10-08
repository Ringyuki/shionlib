import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

export function useLeaveGuard(guarded: boolean) {
  const released = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      guarded && !released.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!guarded) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (!released.current) {
        event.preventDefault()
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [guarded])
  return {
    leaving: blocker.state === 'blocked',
    leave: () => blocker.proceed?.(),
    stay: () => blocker.reset?.(),
    release: () => {
      released.current = true
    },
  }
}

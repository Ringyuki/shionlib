import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

export function useLeaveGuard(guarded: boolean) {
  const released = useRef(false)
  const confirmed = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) {
      return false
    }
    if (released.current) {
      released.current = false
      return false
    }
    if (guarded) {
      confirmed.current = false
    }
    return guarded
  })
  useEffect(() => {
    if (!guarded) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [guarded])
  return {
    leaving: blocker.state === 'blocked',
    leave: () => {
      confirmed.current = true
      blocker.proceed?.()
    },
    stay: () => {
      if (!confirmed.current) {
        blocker.reset?.()
      }
    },
    release: () => {
      released.current = true
    },
  }
}

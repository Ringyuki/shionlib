'use client'

import { useEffect, useRef } from 'react'
import { refreshAuthSession } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
import { readAuthSessionExpiry, shouldRefreshAuthSession } from '@/utils/auth/session-expiry'

const AUTH_SESSION_CHECK_INTERVAL_MS = 30_000 // 30 seconds
const AUTH_SESSION_REFRESH_LEEWAY_MS = 60_000 // 60 seconds

export const AuthSessionCheck = () => {
  const isLogin = useShionlibUserStore(state => !!state.user?.id)
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (!isLogin) {
      refreshingRef.current = false
      return
    }

    let cancelled = false

    const checkSession = async () => {
      if (cancelled || refreshingRef.current) return
      if (document.visibilityState === 'hidden') return

      const session = readAuthSessionExpiry()
      const shouldHydrateSession = !session?.accessTokenExpiresAt
      if (
        !shouldHydrateSession &&
        !shouldRefreshAuthSession(session, AUTH_SESSION_REFRESH_LEEWAY_MS)
      )
        return

      refreshingRef.current = true
      try {
        await refreshAuthSession()
      } catch {
      } finally {
        refreshingRef.current = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      void checkSession()
    }

    void checkSession()
    const interval = window.setInterval(() => {
      void checkSession()
    }, AUTH_SESSION_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isLogin])

  return null
}

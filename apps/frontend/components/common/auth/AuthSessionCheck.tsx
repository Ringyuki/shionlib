'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { shionlibRequest, triggerProactiveRefresh } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'

const PRE_REFRESH_THRESHOLD_MS = 60_000 * 5 // refresh when < 5 min remaining
const CHECK_INTERVAL_MS = 60_000 // check every 60 seconds

export const AuthSessionCheck = () => {
  const pathname = usePathname()
  const isLogin = useShionlibUserStore(state => Boolean(state.user?.id))

  useEffect(() => {
    const check = () => {
      const { user, accessTokenExp } = useShionlibUserStore.getState()
      if (!user?.id || accessTokenExp === null) return
      if (accessTokenExp - Date.now() <= PRE_REFRESH_THRESHOLD_MS) {
        void triggerProactiveRefresh()
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isLogin) return
    setTimeout(async () => {
      void shionlibRequest({ forceNotThrowError: true })
        .get('/user/me')
        .catch(() => {})
    }, 1_000)
  }, [pathname, isLogin])

  return null
}

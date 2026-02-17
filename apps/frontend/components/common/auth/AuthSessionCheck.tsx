'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'

export const AuthSessionCheck = () => {
  const pathname = usePathname()
  const isLogin = useShionlibUserStore(state => Boolean(state.user?.id))

  useEffect(() => {
    if (!isLogin) return
    void shionlibRequest({ forceNotThrowError: true })
      .get('/user/me')
      .catch(() => {})
  }, [pathname, isLogin])

  return null
}

'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
import { User } from '@/interfaces/user/user.interface'

export const OidcResultHandler = () => {
  const t = useTranslations('Components.Common.User.Login')
  const { setUser } = useShionlibUserStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const login = params.get('oidc_login')
    const error = params.get('oidc_error')
    if (login !== '1' && !error) return

    params.delete('oidc_login')
    params.delete('oidc_error')
    const qs = params.toString()
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
    )

    if (error) {
      sileo.error({ title: t('oidcError') })
      return
    }

    void shionlibRequest()
      .get<User>('/user/me')
      .then(res => {
        if (res.data) {
          setUser(res.data)
          sileo.success({ title: t('success') })
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

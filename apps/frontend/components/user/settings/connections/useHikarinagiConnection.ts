'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { sileo } from 'sileo'
import { shionlibRequest } from '@/utils/request'
import { OidcIdentitiesResponse, OidcIdentityItem } from '@/interfaces/auth/oidc.interface'

const PROVIDER = 'hikarinagi'

export const useHikarinagiConnection = () => {
  const t = useTranslations('Components.User.Settings.Connections.Hikarinagi')
  const [identity, setIdentity] = useState<OidcIdentityItem | null>(null)
  const [canUnlink, setCanUnlink] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unlinking, setUnlinking] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const res = await shionlibRequest({ forceThrowError: true }).get<OidcIdentitiesResponse>(
        '/auth/oidc/identities',
      )
      setIdentity(res.data?.items.find(item => item.provider === PROVIDER) ?? null)
      setCanUnlink(res.data?.can_unlink ?? false)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const startLink = () => {
    const returnTo = window.location.pathname + window.location.search
    window.location.href = `/api/auth/oidc/start?mode=link&returnTo=${encodeURIComponent(returnTo)}`
  }

  const unlink = async (id: number) => {
    try {
      setUnlinking(true)
      await shionlibRequest().delete(`/auth/oidc/identities/${id}`)
      setIdentity(null)
      sileo.success({ title: t('unlinkSuccess') })
    } catch {
    } finally {
      setUnlinking(false)
    }
  }

  return { identity, canUnlink, loading, unlinking, startLink, unlink }
}

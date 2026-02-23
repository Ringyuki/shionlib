'use client'

import { useEffect, useState } from 'react'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import {
  PasskeyCredentialItem,
  PasskeyCreationOptionsPayload,
} from '@/interfaces/auth/passkey.interface'
import { markDeviceHasPasskeyHint } from '@/components/common/user/passkey/helpers/device-passkey-hint'
import { useTranslations } from 'next-intl'

export const usePasskeyManager = () => {
  const t = useTranslations('Components.User.Settings.Passkey')
  const [items, setItems] = useState<PasskeyCredentialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [supported, setSupported] = useState(false)
  const [name, setName] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const res = await shionlibRequest({ forceThrowError: true }).get<PasskeyCredentialItem[]>(
        '/auth/passkey',
      )
      setItems(res.data ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      setSupported(browserSupportsWebAuthn())
    } catch {
      setSupported(false)
    }
    void load()
  }, [])

  const registerPasskey = async () => {
    if (!(await browserSupportsWebAuthn())) {
      sileo.error({ title: t('unsupported') })
      return
    }

    let optionsData: PasskeyCreationOptionsPayload | null | undefined
    try {
      setRegistering(true)
      const trimmedName = name.trim()
      const optionsRes = await shionlibRequest({
        forceThrowError: true,
      }).post<PasskeyCreationOptionsPayload>('/auth/passkey/register/options', {
        data: trimmedName ? { name: trimmedName } : {},
      })
      optionsData = optionsRes.data
      if (!optionsData) return

      const credential = await startRegistration({
        optionsJSON: optionsData.options,
      })

      await shionlibRequest({ forceThrowError: true }).post('/auth/passkey/register/verify', {
        data: {
          flow_id: optionsData.flow_id,
          response: credential,
          ...(trimmedName ? { name: trimmedName } : {}),
        },
      })

      markDeviceHasPasskeyHint()
      sileo.success({ title: t('addSuccess') })
      setName('')
      await load()
    } catch (error) {
      console.warn('[passkey] registration failed', {
        error,
        origin: typeof location !== 'undefined' ? location.origin : undefined,
        rpId: optionsData?.options?.rp?.id,
      })
    } finally {
      setRegistering(false)
    }
  }

  const removePasskey = async (id: number) => {
    try {
      setRemovingId(id)
      await shionlibRequest({ forceThrowError: true }).delete(`/auth/passkey/${id}`)
      setItems(current => current.filter(item => item.id !== id))
      sileo.success({ title: t('removeSuccess') })
    } catch {
    } finally {
      setRemovingId(current => (current === id ? null : current))
    }
  }

  return {
    items,
    loading,
    supported,
    registering,
    removingId,
    name,
    setName,
    registerPasskey,
    removePasskey,
  }
}

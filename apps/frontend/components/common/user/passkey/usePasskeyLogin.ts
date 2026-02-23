'use client'

import { useState } from 'react'
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { PasskeyRequestOptionsPayload } from '@/interfaces/auth/passkey.interface'
import { markDeviceHasPasskeyHint } from '@/components/common/user/passkey/helpers/device-passkey-hint'
import { useTranslations } from 'next-intl'

interface UsePasskeyLoginOptions {
  onSuccess?: () => Promise<void> | void
  getIdentifier?: () => string
}

interface PasskeyLoginActionOptions {
  silent?: boolean
}

type PasskeyLoginResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'unsupported'
        | 'options_failed'
        | 'no_options'
        | 'no_credentials'
        | 'cancelled'
        | 'verify_failed'
        | 'error'
    }

const isUserCancelledPasskeyPrompt = (error: unknown) => {
  const err = error as {
    name?: unknown
    message?: unknown
    cause?: { name?: unknown; message?: unknown }
  }
  const names = [err?.name, err?.cause?.name].filter((v): v is string => typeof v === 'string')
  if (names.some(name => name === 'NotAllowedError' || name === 'AbortError')) return true

  const messages = [err?.message, err?.cause?.message]
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.toLowerCase())

  return messages.some(
    message =>
      message.includes('notallowederror') ||
      message.includes('aborterror') ||
      message.includes('not allowed') ||
      message.includes('timed out') ||
      message.includes('cancel'),
  )
}

export const usePasskeyLogin = ({ onSuccess, getIdentifier }: UsePasskeyLoginOptions = {}) => {
  const [loading, setLoading] = useState(false)
  const t = useTranslations('Components.Common.User.Login')

  const login = async ({
    silent = false,
  }: PasskeyLoginActionOptions = {}): Promise<PasskeyLoginResult> => {
    if (!browserSupportsWebAuthn()) {
      if (!silent) sileo.error({ title: t('passkeyUnsupported') })
      return { ok: false, reason: 'unsupported' }
    }

    let optionsData: PasskeyRequestOptionsPayload | null | undefined
    try {
      setLoading(true)
      const identifier = getIdentifier?.().trim()
      const optionsRes = await shionlibRequest(
        silent ? { forceNotThrowError: true } : { forceThrowError: true },
      ).post<PasskeyRequestOptionsPayload>('/auth/passkey/login/options', {
        data: identifier ? { identifier } : {},
      })
      if (optionsRes.code !== 0) return { ok: false, reason: 'options_failed' }

      optionsData = optionsRes.data
      if (!optionsData) return { ok: false, reason: 'no_options' }
      if (identifier && (optionsData.options.allowCredentials?.length ?? 0) === 0) {
        return { ok: false, reason: 'no_credentials' }
      }

      let assertion: Awaited<ReturnType<typeof startAuthentication>>
      try {
        assertion = await startAuthentication({
          optionsJSON: optionsData.options,
        })
      } catch (error) {
        if (isUserCancelledPasskeyPrompt(error)) {
          return { ok: false, reason: 'cancelled' }
        }
        throw error
      }

      const verifyRes = await shionlibRequest(
        silent ? { forceNotThrowError: true } : { forceThrowError: true },
      ).post('/auth/passkey/login/verify', {
        data: {
          flow_id: optionsData.flow_id,
          response: assertion,
        },
      })
      if (verifyRes.code !== 0) return { ok: false, reason: 'verify_failed' }

      markDeviceHasPasskeyHint()
      await onSuccess?.()
      return { ok: true }
    } catch (error) {
      console.warn('[passkey] login failed', {
        error,
        silent,
        origin: typeof location !== 'undefined' ? location.origin : undefined,
        identifierSupplied: Boolean(getIdentifier?.().trim()),
        rpId: optionsData?.options?.rpId,
      })
      return { ok: false, reason: 'error' }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    login,
  }
}

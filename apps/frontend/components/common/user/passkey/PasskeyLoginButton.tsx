'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/shionui/Button'
import { usePasskeyLogin } from '@/components/common/user/passkey/usePasskeyLogin'
import { useTranslations } from 'next-intl'
import { KeyRound } from 'lucide-react'

interface PasskeyLoginButtonProps {
  disabled?: boolean
  identifier?: string
  onSuccess?: () => Promise<void> | void
  autoAttempt?: boolean
}

const AUTO_PASSKEY_LOGIN_SUPPRESS_KEY = 'shionlib:passkey-login:auto-attempt-suppressed'

const isAutoAttemptSuppressedForSession = () => {
  try {
    return sessionStorage.getItem(AUTO_PASSKEY_LOGIN_SUPPRESS_KEY) === '1'
  } catch {
    return false
  }
}

const suppressAutoAttemptForSession = () => {
  try {
    sessionStorage.setItem(AUTO_PASSKEY_LOGIN_SUPPRESS_KEY, '1')
  } catch {}
}

export const PasskeyLoginButton = ({
  disabled,
  identifier,
  onSuccess,
  autoAttempt = false,
}: PasskeyLoginButtonProps) => {
  const t = useTranslations('Components.Common.User.Login')
  const { loading, login } = usePasskeyLogin({
    onSuccess,
    getIdentifier: () => identifier || '',
  })
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (!autoAttempt) {
      attemptedRef.current = false
      return
    }
    if (attemptedRef.current || disabled || loading) return
    if (isAutoAttemptSuppressedForSession()) {
      attemptedRef.current = true
      return
    }
    attemptedRef.current = true
    void (async () => {
      const result = await login({ silent: true })
      if (!result.ok && result.reason === 'cancelled') {
        suppressAutoAttemptForSession()
      }
    })()
  }, [autoAttempt, disabled, loading, login])

  return (
    <Button
      type="button"
      intent="neutral"
      appearance="soft"
      loading={loading}
      disabled={disabled || loading}
      className="w-full"
      onClick={() => void login()}
      renderIcon={<KeyRound />}
    >
      {t('usePasskey')}
    </Button>
  )
}

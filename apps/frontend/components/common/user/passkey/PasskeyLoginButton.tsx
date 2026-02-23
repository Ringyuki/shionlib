'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/shionui/Button'
import { usePasskeyLogin } from '@/components/common/user/passkey/usePasskeyLogin'
import { hasDevicePasskeyHint } from '@/components/common/user/passkey/helpers/device-passkey-hint'
import {
  isAutoPasskeyAttemptSuppressedForSession,
  suppressAutoPasskeyAttemptForSession,
} from '@/components/common/user/passkey/helpers/auto-passkey-attempt-suppress'
import { useIsAutomatingBrowser } from '@/hooks/useIsAutomatingBrowser'
import { useTranslations } from 'next-intl'
import { KeyRound } from 'lucide-react'

interface PasskeyLoginButtonProps {
  disabled?: boolean
  identifier?: string
  onSuccess?: () => Promise<void> | void
  autoAttempt?: boolean
}

export const PasskeyLoginButton = ({
  disabled,
  identifier,
  onSuccess,
  autoAttempt = false,
}: PasskeyLoginButtonProps) => {
  const t = useTranslations('Components.Common.User.Login')
  const isAutomationBrowser = useIsAutomatingBrowser()
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
    if (isAutomationBrowser()) {
      attemptedRef.current = true
      return
    }
    if (!hasDevicePasskeyHint()) {
      attemptedRef.current = true
      return
    }
    if (isAutoPasskeyAttemptSuppressedForSession()) {
      attemptedRef.current = true
      return
    }
    attemptedRef.current = true
    void (async () => {
      const result = await login({ silent: true })
      if (!result.ok && result.reason === 'cancelled') {
        suppressAutoPasskeyAttemptForSession()
      }
    })()
  }, [autoAttempt, disabled, loading, login, isAutomationBrowser])

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

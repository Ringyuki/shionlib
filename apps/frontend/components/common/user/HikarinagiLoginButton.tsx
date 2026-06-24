'use client'

import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'

interface HikarinagiLoginButtonProps {
  disabled?: boolean
}

export const HikarinagiLoginButton = ({ disabled }: HikarinagiLoginButtonProps) => {
  const t = useTranslations('Components.Common.User.Login')

  const start = () => {
    const returnTo = window.location.pathname + window.location.search
    window.location.href = `/api/auth/oidc/start?returnTo=${encodeURIComponent(returnTo)}`
  }

  return (
    <Button
      type="button"
      intent="neutral"
      appearance="soft"
      disabled={disabled}
      className="w-full"
      onClick={start}
      renderIcon={
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/hikarinagi.ico" alt="" className="h-4 w-4 rounded-sm" />
      }
    >
      {t('useHikarinagi')}
    </Button>
  )
}

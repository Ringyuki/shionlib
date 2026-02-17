'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { GetEmail, getEmailSchema } from './GetEmail'
import { z } from 'zod'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useState } from 'react'
import { useCountdown } from '@/hooks/useCountdown'
import { Reset, resetSchema } from './Reset'
import { useShionlibUserStore } from '@/store/userStore'
import { useRouter } from '@/i18n/navigation.client'

export const Forget = () => {
  const t = useTranslations('Components.Common.Auth.Password.Forget')
  const router = useRouter()
  const { logout } = useShionlibUserStore()

  const [isGettingSign, setIsGettingSign] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const { countdown, isCountingDown, startCountdown } = useCountdown({ duration: 60 })
  const handleGetSign = async (data: z.infer<typeof getEmailSchema>) => {
    setIsGettingSign(true)
    try {
      await shionlibRequest({ forceThrowError: true }).post('/auth/password/forget', {
        data: {
          email: data.email,
        },
      })
      // toast.success(t('signSent'))
      sileo.success({ title: t('signSent') })
      startCountdown()
    } catch {
    } finally {
      setIsGettingSign(false)
    }
  }

  const token = useSearchParams().get('token')
  const email = useSearchParams().get('email')
  if (!token || !email)
    return (
      <GetEmail
        onSubmit={handleGetSign}
        loading={isGettingSign}
        isCountingDown={isCountingDown}
        countdown={countdown}
      />
    )

  const handleReset = async (data: z.infer<typeof resetSchema>) => {
    setIsResetting(true)
    try {
      await shionlibRequest({ forceThrowError: true }).post('/auth/password/forget/reset', {
        data: {
          token,
          email,
          password: data.password,
        },
      })
      // toast.success(t('resetSuccess'))
      sileo.success({ title: t('resetSuccess') })
      await logout()
      router.push('/')
    } catch {
    } finally {
      setIsResetting(false)
    }
  }
  return <Reset token={token} email={email} onSubmit={handleReset} loading={isResetting} />
}

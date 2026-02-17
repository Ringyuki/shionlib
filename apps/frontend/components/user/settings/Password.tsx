'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
  CardContent,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { useState, useRef } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { Lock } from 'lucide-react'
import { useRouter } from '@/i18n/navigation.client'
import { PasswordForm } from '@/components/user/settings/PasswordForm'
import { passwordSchemaInterface } from '@/components/user/settings/PasswordForm'
import { z } from 'zod'

export const PasswordSettings = () => {
  const t = useTranslations('Components.User.Settings.Password')
  const { logout } = useShionlibUserStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()
  const passwordFormRef = useRef<{
    submitForm: () => void
  }>(null)

  const submitForm = async () => {
    passwordFormRef.current?.submitForm()
  }
  const handleUpdate = async (data: z.infer<typeof passwordSchemaInterface>) => {
    try {
      setIsUpdating(true)
      await shionlibRequest().post('/user/info/password', {
        data: {
          old_password: data.current_password,
          password: data.password,
        },
      })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      await logout()
    } catch {
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardDescription className="text-card-foreground">{t('note')}</CardDescription>
        <CardAction>
          <Lock className="size-12 text-warning" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <PasswordForm onSubmit={handleUpdate} ref={passwordFormRef} />
      </CardContent>
      <CardFooter className="flex flex-row gap-2">
        <Button intent="primary" onClick={submitForm} loading={isUpdating} loginRequired>
          {t('update')}
        </Button>
        <Button
          appearance="ghost"
          intent="secondary"
          onClick={() => router.push('/user/password/forget')}
        >
          {t('forget')}
        </Button>
      </CardFooter>
    </Card>
  )
}

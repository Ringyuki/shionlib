'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Input } from '@/components/shionui/Input'
import { User } from '@/interfaces/user/user.interface'
import { shionlibRequest } from '@/utils/request'
import { DialogFlow } from '@/components/user/settings/email/DialogFlow'
import { DrawerFlow } from '@/components/user/settings/email/DrawerFlow'
import { useMedia } from 'react-use'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useShionlibUserStore } from '@/store/userStore'
import { useCountdown } from '@/hooks/useCountdown'

interface EmailSettingsProps {
  email: User['email']
}

export const EmailSettings = ({ email }: EmailSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Email')
  const [isGettingCode, setIsGettingCode] = useState(false)
  const [currentCodeUuid, setCurrentCodeUuid] = useState<string | null>(null)
  const { logout } = useShionlibUserStore()
  const isMobile = useMedia('(max-width: 1024px)', false)
  const [open, setOpen] = useState(false)

  const { countdown, isCountingDown, startCountdown } = useCountdown({ duration: 60 })
  const handleGetCode = async () => {
    setIsGettingCode(true)
    try {
      const data = await shionlibRequest().post<{ uuid: string }>('/user/info/email/request')
      setCurrentCodeUuid(data.data?.uuid!)
      startCountdown()
      setOpen(true)
    } catch {
    } finally {
      setIsGettingCode(false)
    }
  }

  const [isUpdating, setIsUpdating] = useState(false)
  const onSubmit = async (data: {
    currentCode: string
    newEmail: string
    newEmailCodeUuid: string
    newEmailCode: string
  }) => {
    try {
      setIsUpdating(true)
      await shionlibRequest().post('/user/info/email', {
        data: {
          email: data.newEmail,
          newCode: data.newEmailCode,
          newUuid: data.newEmailCodeUuid,
          currentCode: data.currentCode,
          currentUuid: currentCodeUuid,
        },
      })
      setOpen(false)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      await logout()
    } catch {
    } finally {
      setIsUpdating(false)
    }
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('title')}</CardTitle>
          <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
          <CardAction>
            <Mail className="size-12 text-success" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <span className="text-sm">{t('currentEmail')}</span>
          <Input value={email} readOnly disabled />
          <span className="text-sm text-muted-foreground">{t('help')}</span>
        </CardContent>
        <CardFooter>
          <Button
            intent="primary"
            onClick={handleGetCode}
            disabled={isCountingDown}
            loading={isGettingCode}
          >
            {/* {isCountingDown ? `${countdown}s` : t('update')} */}
            {t('update') + (isCountingDown ? ` (${countdown}s)` : '')}
          </Button>
        </CardFooter>
      </Card>
      {isMobile ? (
        <DrawerFlow
          open={open}
          onOpenChange={setOpen}
          currentEmail={email!}
          onSubmit={onSubmit}
          isSubmitting={isUpdating}
        />
      ) : (
        <DialogFlow
          open={open}
          onOpenChange={setOpen}
          currentEmail={email!}
          onSubmit={onSubmit}
          isSubmitting={isUpdating}
        />
      )}
    </>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { useAuthDialogStore } from '@/store/authDialogStore'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/shionui/Card'

export const LoginRequired = () => {
  const t = useTranslations('Pages.User.Settings.loginRequired')
  const { openAuthDialog } = useAuthDialogStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <LogIn className="size-10 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Button intent="primary" onClick={() => openAuthDialog('login')}>
          {t('login')}
        </Button>
      </CardContent>
    </Card>
  )
}

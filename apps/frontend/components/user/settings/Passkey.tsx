'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { KeyRound } from 'lucide-react'
import { usePasskeyManager } from '@/components/user/settings/passkey/usePasskeyManager'
import { PasskeyList } from '@/components/user/settings/passkey/PasskeyList'
import { useTranslations } from 'next-intl'

export const PasskeySettings = () => {
  const t = useTranslations('Components.User.Settings.Passkey')
  const {
    items,
    loading,
    supported,
    registering,
    removingId,
    name,
    setName,
    registerPasskey,
    removePasskey,
  } = usePasskeyManager()

  return (
    <Card data-testid="settings-passkey-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        {!supported ? (
          <CardDescription className="text-warning">{t('unsupported')}</CardDescription>
        ) : null}
        <CardAction>
          <KeyRound className="size-12 text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={128}
            disabled={!supported || registering}
            data-testid="settings-passkey-name-input"
          />
          <Button
            intent="primary"
            onClick={registerPasskey}
            loading={registering}
            disabled={!supported || loading}
            data-testid="settings-passkey-add"
            loginRequired
          >
            {t('add')}
          </Button>
        </div>
        {loading ? (
          <div className="text-muted-foreground text-sm">{t('loading')}</div>
        ) : (
          <PasskeyList items={items} removingId={removingId} onRemove={removePasskey} />
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div className="text-muted-foreground text-xs">{t('count', { count: items.length })}</div>
      </CardFooter>
    </Card>
  )
}

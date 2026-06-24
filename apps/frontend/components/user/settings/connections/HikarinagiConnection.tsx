'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link2, Unlink } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shionui/AlertDialog'
import { useHikarinagiConnection } from './useHikarinagiConnection'

export const HikarinagiConnection = () => {
  const t = useTranslations('Components.User.Settings.Connections.Hikarinagi')
  const { identity, canUnlink, loading, unlinking, startLink, unlink } = useHikarinagiConnection()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const connected = !!identity

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            {t('title')}
            <Badge
              intent={connected ? 'success' : 'neutral'}
              appearance={connected ? 'solid' : 'outline'}
            >
              {connected ? t('connected') : t('notConnected')}
            </Badge>
          </CardTitle>
          <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
          <CardAction>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hikarinagi.ico"
              alt="Hikarinagi"
              className="size-12 rounded-md object-contain"
            />
          </CardAction>
        </CardHeader>

        {connected && identity?.email_at_link && (
          <div className="text-muted-foreground px-6 text-sm">
            {t('connectedAs')} {identity.email_at_link}
          </div>
        )}

        <CardFooter className="flex-col items-start gap-2">
          {connected ? (
            <>
              <Button
                intent="destructive"
                disabled={!canUnlink || loading}
                onClick={() => setConfirmOpen(true)}
                renderIcon={<Unlink />}
              >
                {t('disconnect')}
              </Button>
              {!canUnlink && <p className="text-muted-foreground text-xs">{t('lastMethodHint')}</p>}
            </>
          ) : (
            <Button intent="primary" disabled={loading} onClick={startLink} renderIcon={<Link2 />}>
              {t('connect')}
            </Button>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle tone="destructive">{t('UnlinkConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('UnlinkConfirm.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('UnlinkConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="destructive"
              loading={unlinking}
              onClick={async () => {
                if (!identity) return
                await unlink(identity.id)
                setConfirmOpen(false)
              }}
            >
              {t('UnlinkConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

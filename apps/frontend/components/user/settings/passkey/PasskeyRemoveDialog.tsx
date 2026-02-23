'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/shionui/AlertDialog'

interface PasskeyRemoveDialogProps {
  passkeyId: number
  passkeyName?: string | null
  loading?: boolean
  onConfirm: (id: number) => void | Promise<void>
}

export const PasskeyRemoveDialog = ({
  passkeyId,
  passkeyName,
  loading = false,
  onConfirm,
}: PasskeyRemoveDialogProps) => {
  const t = useTranslations('Components.User.Settings.Passkey')
  const [open, setOpen] = useState(false)

  const displayName = passkeyName?.trim() || t('unnamed')

  const handleConfirm = async () => {
    await onConfirm(passkeyId)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen} countdown={0}>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          appearance="ghost"
          intent="destructive"
          loading={loading}
          data-testid={`settings-passkey-remove-${passkeyId}`}
          aria-label={t('remove')}
          renderIcon={<Trash2 />}
          loginRequired
        />
      </AlertDialogTrigger>
      <AlertDialogContent
        tone="destructive"
        data-testid={`settings-passkey-remove-dialog-${passkeyId}`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle tone="destructive">{t('removeDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('removeDialog.description', { name: displayName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('removeDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            tone="destructive"
            onClick={handleConfirm}
            loading={loading}
            data-testid={`settings-passkey-remove-confirm-${passkeyId}`}
          >
            {t('removeDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

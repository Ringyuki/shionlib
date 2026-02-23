'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useShionlibUserStore } from '@/store/userStore'
import { usePostLoginPasskeyNudge } from '@/components/common/user/passkey/usePostLoginPasskeyNudge'
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

interface PasskeyBindNudgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PasskeyBindNudgeDialog = ({ open, onOpenChange }: PasskeyBindNudgeDialogProps) => {
  const t = useTranslations('Components.Common.User.PasskeyBindNudgeDialog')
  const router = useRouter()
  const userId = useShionlibUserStore(state => state.user.id)
  const { closePasskeyBindNudgeDialog } = useAuthDialogStore()
  const { dismissForSession } = usePostLoginPasskeyNudge()

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && open) dismissForSession(userId)
    onOpenChange(nextOpen)
  }

  const handleLater = () => {
    dismissForSession(userId)
  }

  const handleGoToSettings = () => {
    dismissForSession(userId)
    closePasskeyBindNudgeDialog()
    router.push('/user/settings/security')
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange} countdown={0}>
      <AlertDialogContent tone="info" data-testid="passkey-bind-nudge-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle tone="info">{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          <AlertDialogDescription>{t('hint')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>{t('later')}</AlertDialogCancel>
          <AlertDialogAction tone="info" onClick={handleGoToSettings}>
            {t('goToSettings')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

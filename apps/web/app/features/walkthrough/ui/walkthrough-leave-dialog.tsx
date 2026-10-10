import { AlertDialog } from '@hina-ui/react'
import { useTranslations } from 'use-intl'

type LeaveGuard = { leaving: boolean; leave: () => void; stay: () => void }

export function WalkthroughLeaveDialog({ guard }: { guard: LeaveGuard }) {
  const t = useTranslations('walkthrough')
  return (
    <AlertDialog
      title={t('leaveConfirm')}
      description={t('leaveDescription')}
      confirmText={t('leave')}
      cancelText={t('stay')}
      tone="danger"
      open={guard.leaving}
      onOpenChange={open => {
        if (!open) {
          guard.stay()
        }
      }}
      onConfirm={() => guard.leave()}
    />
  )
}

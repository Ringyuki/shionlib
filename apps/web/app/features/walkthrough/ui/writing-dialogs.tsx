import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useWalkthroughRemoval } from '../use-walkthrough-removal'

type LeaveGuard = { leaving: boolean; leave: () => void; stay: () => void }

export function LeaveDialog({ guard }: { guard: LeaveGuard }) {
  const t = useTranslations('walkthrough')
  return (
    <AlertDialog
      title={t('leaveConfirm')}
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

type RemoveDialogProps = {
  walkthroughId: number | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
}

export function RemoveDialog({ walkthroughId, open, onOpenChange, onRemoved }: RemoveDialogProps) {
  const t = useTranslations('walkthrough')
  const removal = useWalkthroughRemoval()
  return (
    <AlertDialog
      title={t('removeConfirm')}
      description={t('removeDescription')}
      confirmText={t('delete')}
      cancelText={t('cancel')}
      tone="danger"
      open={open && walkthroughId !== undefined}
      onOpenChange={onOpenChange}
      onConfirm={async () => {
        if (walkthroughId !== undefined) {
          await removal.confirm({ walkthroughId })
          toast.success(t('removed'))
          onRemoved()
        }
      }}
    />
  )
}

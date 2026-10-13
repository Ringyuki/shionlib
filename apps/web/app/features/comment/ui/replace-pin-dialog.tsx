import { AlertDialog } from '@hina-ui/react'
import { useTranslations } from 'use-intl'

type ReplacePinDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function ReplacePinDialog({ open, onOpenChange, onConfirm }: ReplacePinDialogProps) {
  const t = useTranslations('comment')
  return (
    <AlertDialog
      title={t('replacePin')}
      description={t('replacePinDescription')}
      confirmText={t('pin')}
      cancelText={t('cancel')}
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
}

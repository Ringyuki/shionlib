import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { isFailure } from '~/shared/api/failure.schema'
import { useDeleteResource } from '../use-delete-resource'

type DeleteDialogProps = {
  resourceId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteDialog({ resourceId, open, onOpenChange }: DeleteDialogProps) {
  const t = useTranslations('resource')
  const deletion = useDeleteResource(() => toast.success(t('deleted')))
  return (
    <AlertDialog
      title={t('deleteConfirm')}
      description={t('deleteDescription')}
      confirmText={t('delete')}
      cancelText={t('cancel')}
      tone="danger"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => deletion.confirm({ resourceId })}
      onError={error => {
        if (isFailure(error)) {
          toast.danger(error.message)
        }
      }}
    />
  )
}

import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { ResourceFile } from '../resource'
import { useRemoveFile } from '../use-remove-file'

type RemoveFileDialogProps = {
  file: ResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RemoveFileDialog({ file, open, onOpenChange }: RemoveFileDialogProps) {
  const t = useTranslations('resource')
  const removal = useRemoveFile(
    () => toast.success(t('fileRemoved')),
    failure => toast.danger(failure.message),
  )
  return (
    <AlertDialog
      title={t('removeFileConfirm', { name: file.file_name })}
      description={t('removeFileDescription')}
      confirmText={t('removeFile')}
      cancelText={t('cancel')}
      tone="danger"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => removal.submit({ fileId: file.id })}
    />
  )
}

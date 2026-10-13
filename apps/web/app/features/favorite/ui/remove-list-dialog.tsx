import { AlertDialog, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { FavoriteList } from '../favorite'
import { useListRemoval } from '../use-list-removal'

type RemoveListDialogProps = {
  list: FavoriteList
  open: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
}

export function RemoveListDialog({ list, open, onOpenChange, onRemoved }: RemoveListDialogProps) {
  const t = useTranslations('favorite')
  const removal = useListRemoval()
  return (
    <AlertDialog
      title={t('removeListConfirm', { name: list.name })}
      description={t('removeListDescription')}
      confirmText={t('removeList')}
      cancelText={t('cancel')}
      tone="danger"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={async () => {
        await removal.confirm({ listId: list.id })
        toast.success(t('listRemoved'))
        onRemoved()
      }}
    />
  )
}

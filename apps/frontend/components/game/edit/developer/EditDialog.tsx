'use client'

import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { EditContent } from './EditContent'
import { developerRelationSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDialogProps {
  relation: DeveloperRelation
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof developerRelationSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDialog = ({
  relation,
  game_id,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDialogProps) => {
  const t = useTranslations('Components.Game.Edit.Developer.Edit')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditContent
          relation={relation}
          game_id={game_id}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  )
}

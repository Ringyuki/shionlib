import { GameCover } from '@/interfaces/game/game.interface'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { EditContent } from './EditContent'
import { gameCoverSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDialogProps {
  cover: GameCover
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameCoverSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDialog = ({
  cover,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDialogProps) => {
  const t = useTranslations('Components.Game.Edit.Cover.Edit')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditContent
          cover={cover}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  )
}

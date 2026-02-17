import { GameImage } from '@/interfaces/game/game.interface'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { EditContent } from './EditContent'
import { gameImageSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDialogProps {
  image: GameImage
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameImageSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDialog = ({
  image,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDialogProps) => {
  const t = useTranslations('Components.Game.Edit.Image.Edit')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditContent
          image={image}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  )
}

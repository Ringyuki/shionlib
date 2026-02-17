import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { EditContent } from './EditContent'
import { useTranslations } from 'next-intl'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { z } from 'zod'

interface EditDialogProps {
  downloadResource: GameDownloadResource
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameDownloadSourceSchemaType>) => void
  isSubmitting: boolean
}

export const EditDialog = ({
  downloadResource,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: EditDialogProps) => {
  const t = useTranslations('Components.Game.Download.Edit')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <EditContent
          downloadResource={downloadResource}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  )
}

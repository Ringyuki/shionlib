import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { EditContent } from './EditContent'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { gameDownloadSourceSchemaType } from '@/components/game/upload/GameDownloadSourceInfoForm'
import { z } from 'zod'

interface EditDrawerProps {
  downloadResource: GameDownloadResource
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameDownloadSourceSchemaType>) => void
  isSubmitting: boolean
}

export const EditDrawer = ({
  downloadResource,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: EditDrawerProps) => {
  const t = useTranslations('Components.Game.Download.Edit')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-h-[40vh] px-3 pb-4" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <EditContent
          downloadResource={downloadResource}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </DrawerContent>
    </Drawer>
  )
}

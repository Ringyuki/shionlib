import { GameCover } from '@/interfaces/game/game.interface'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { EditContent } from './EditContent'
import { gameCoverSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDrawerProps {
  cover: GameCover
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameCoverSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDrawer = ({
  cover,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDrawerProps) => {
  const t = useTranslations('Components.Game.Edit.Cover.Edit')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-h-[40vh] px-3 pb-4" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <EditContent
          cover={cover}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </DrawerContent>
    </Drawer>
  )
}

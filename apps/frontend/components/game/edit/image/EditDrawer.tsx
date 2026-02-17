import { GameImage } from '@/interfaces/game/game.interface'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { EditContent } from './EditContent'
import { gameImageSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDrawerProps {
  image: GameImage
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof gameImageSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDrawer = ({
  image,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDrawerProps) => {
  const t = useTranslations('Components.Game.Edit.Image.Edit')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-h-[40vh] px-3 pb-4" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <EditContent
          image={image}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onDelete={onDelete}
        />
      </DrawerContent>
    </Drawer>
  )
}

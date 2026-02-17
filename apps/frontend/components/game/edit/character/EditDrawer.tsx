'use client'

import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { EditContent } from './EditContent'
import { characterRelationSchemaType } from './Form'
import { z } from 'zod'
import { useTranslations } from 'next-intl'

interface EditDrawerProps {
  relation: GameCharacterRelation
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: z.infer<typeof characterRelationSchemaType>) => void
  isSubmitting: boolean
  onDelete: (id: number) => void
}

export const EditDrawer = ({
  relation,
  game_id,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  onDelete,
}: EditDrawerProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Edit')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <EditContent
            relation={relation}
            game_id={game_id}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            onDelete={onDelete}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

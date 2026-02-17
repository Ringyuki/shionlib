'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { HistoryContent } from './HistoryContent'
import { useTranslations } from 'next-intl'
import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'

interface HistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: GameDownloadResourceFileHistory[]
}

export const HistoryDrawer = ({ open, onOpenChange, histories }: HistoryDrawerProps) => {
  const t = useTranslations('Components.Game.Download.History')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">
          <HistoryContent histories={histories} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { GameDownloadContent } from './GameDownloadContent'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface GameDownloadDrawerProps {
  downloadResources: GameDownloadResource[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: number, data: Partial<GameDownloadResource>) => void
  onDelete: (id: number) => void
}

export const GameDownloadDrawer = ({
  downloadResources,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: GameDownloadDrawerProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadDrawer')
  const [turnstileOpen, setTurnstileOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={!turnstileOpen}>
      <DrawerContent className="min-h-[50vh]" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <GameDownloadContent
          downloadResources={downloadResources}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onTurnstileOpenChange={setTurnstileOpen}
        />
      </DrawerContent>
    </Drawer>
  )
}

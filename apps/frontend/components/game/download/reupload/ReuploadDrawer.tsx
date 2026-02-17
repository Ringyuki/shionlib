import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { ReuploadContent } from './ReuploadContent'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { useState } from 'react'

interface ReuploadDrawerProps {
  file: GameDownloadResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
  onReuploadComplete: () => void
}

export const ReuploadDrawer = ({
  file,
  open,
  onOpenChange,
  onReuploadComplete,
}: ReuploadDrawerProps) => {
  const t = useTranslations('Components.Game.Download.Reupload')
  const [closable, setClosable] = useState(true)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={closable}>
      <DrawerContent className="min-h-[60vh] px-3 pb-4" aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <ReuploadContent
          className="overflow-y-auto"
          file={file}
          onClosableChange={setClosable}
          onReuploadComplete={onReuploadComplete}
        />
      </DrawerContent>
    </Drawer>
  )
}

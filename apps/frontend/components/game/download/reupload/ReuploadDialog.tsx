import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { GameDownloadResourceFile } from '@/interfaces/game/game-download-resource'
import { ReuploadContent } from './ReuploadContent'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface ReuploadDialogProps {
  file: GameDownloadResourceFile
  open: boolean
  onOpenChange: (open: boolean) => void
  onReuploadComplete: () => void
}

export const ReuploadDialog = ({
  file,
  open,
  onOpenChange,
  onReuploadComplete,
}: ReuploadDialogProps) => {
  const t = useTranslations('Components.Game.Download.Reupload')
  const [closable, setClosable] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maskClosable={closable}>
      <DialogContent className="lg:max-w-5xl!" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <ReuploadContent
          file={file}
          onClosableChange={setClosable}
          onReuploadComplete={onReuploadComplete}
        />
      </DialogContent>
    </Dialog>
  )
}

import { GameDownloadResource } from '@/interfaces/game/game-download-resource'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { GameDownloadContent } from './GameDownloadContent'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface GameDownloadDialogProps {
  downloadResources: GameDownloadResource[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: number, data: Partial<GameDownloadResource>) => void
  onDelete: (id: number) => void
}

export const GameDownloadDialog = ({
  downloadResources,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: GameDownloadDialogProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadDialog')
  const [turnstileOpen, setTurnstileOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange} maskClosable={!turnstileOpen}>
      <DialogContent aria-describedby={undefined} fitContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <GameDownloadContent
          className="px-0 pb-0"
          downloadResources={downloadResources}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onTurnstileOpenChange={setTurnstileOpen}
        />
      </DialogContent>
    </Dialog>
  )
}

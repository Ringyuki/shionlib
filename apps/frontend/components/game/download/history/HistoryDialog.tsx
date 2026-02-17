'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { HistoryContent } from './HistoryContent'
import { useTranslations } from 'next-intl'
import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'

interface HistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: GameDownloadResourceFileHistory[]
}

export const HistoryDialog = ({ open, onOpenChange, histories }: HistoryDialogProps) => {
  const t = useTranslations('Components.Game.Download.History')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:max-w-3xl!" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <HistoryContent histories={histories} />
      </DialogContent>
    </Dialog>
  )
}

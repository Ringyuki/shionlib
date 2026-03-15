'use client'

import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'
import { HistoryContent } from './HistoryContent'

interface HistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: GameDownloadResourceFileHistory[]
}

export const History = ({ open, onOpenChange, histories }: HistoryProps) => {
  const t = useTranslations('Components.Game.Download.History')

  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      dialogClassName="lg:max-w-3xl"
    >
      <HistoryContent histories={histories} />
    </Modal>
  )
}

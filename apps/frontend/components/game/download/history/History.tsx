'use client'

import { HistoryDialog } from './HistoryDialog'
import { HistoryDrawer } from './HistoryDrawer'
import { useMedia } from 'react-use'
import { GameDownloadResourceFileHistory } from '@/interfaces/game/game-download-resource'

interface HistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: GameDownloadResourceFileHistory[]
}

export const History = ({ open, onOpenChange, histories }: HistoryProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)

  return (
    <>
      {isMobile ? (
        <HistoryDrawer open={open} onOpenChange={onOpenChange} histories={histories} />
      ) : (
        <HistoryDialog open={open} onOpenChange={onOpenChange} histories={histories} />
      )}
    </>
  )
}

'use client'

import { useMedia } from 'react-use'
import { DetailDialog } from './DetailDialog'
import { DetailDrawer } from './DetailDrawer'

interface DetailModalProps {
  messageId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead?: (id: number) => void
}

export const DetailModal = ({ messageId, open, onOpenChange, onRead }: DetailModalProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)
  return (
    <>
      {isMobile ? (
        <DetailDrawer
          messageId={messageId}
          open={open}
          onOpenChange={onOpenChange}
          onRead={onRead}
        />
      ) : (
        <DetailDialog
          messageId={messageId}
          open={open}
          onOpenChange={onOpenChange}
          onRead={onRead}
        />
      )}
    </>
  )
}

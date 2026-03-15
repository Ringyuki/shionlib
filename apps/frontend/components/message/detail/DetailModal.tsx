'use client'

import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { DetailContent } from './DetailContent'

interface DetailModalProps {
  messageId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead?: (id: number) => void
}

export const DetailModal = ({ messageId, open, onOpenChange, onRead }: DetailModalProps) => {
  const t = useTranslations('Components.Message.Detail')
  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      dialogClassName="sm:max-w-2xl"
      drawerClassName="min-h-[50vh]"
    >
      <DetailContent messageId={messageId} open={open} onRead={onRead} className="px-0 pb-4" />
    </Modal>
  )
}

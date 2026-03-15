import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { History } from './History'

interface HistoryContentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  histories: EditRecordItemInterface[]
  pagination: PaginatedMeta
  onPageChange: (page: number) => void
  loading: boolean
}

export const HistoryContent = ({
  open,
  onOpenChange,
  histories,
  pagination,
  onPageChange,
  loading = false,
}: HistoryContentProps) => {
  const t = useTranslations('Components.Game.EditHistory')
  return (
    <Modal title={t('title')} open={open} onOpenChange={onOpenChange} fitContent>
      <History
        histories={histories}
        pagination={pagination}
        onPageChange={onPageChange}
        loading={loading}
        className="max-w-7xl mx-auto"
      />
    </Modal>
  )
}

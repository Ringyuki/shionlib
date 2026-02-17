import { HistoryDialog } from './HistoryDialog'
import { HistoryDrawer } from './HistoryDrawer'
import { useMedia } from 'react-use'
import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'

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
  const isMobile = useMedia('(max-width: 1024px)', false)
  return (
    <div className="hidden">
      {isMobile ? (
        <HistoryDrawer
          open={open}
          onOpenChange={onOpenChange}
          histories={histories}
          pagination={pagination}
          onPageChange={onPageChange}
          loading={loading}
        />
      ) : (
        <HistoryDialog
          open={open}
          onOpenChange={onOpenChange}
          histories={histories}
          pagination={pagination}
          onPageChange={onPageChange}
          loading={loading}
        />
      )}
    </div>
  )
}

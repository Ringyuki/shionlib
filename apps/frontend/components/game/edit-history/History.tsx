import { EditRecordItem } from '@/interfaces/user/edits.interface'
import { HistoryItem } from './HistoryItem'
import { Pagination } from '@/components/common/content/Pagination'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { cn } from '@/utils/cn'

interface HistoryProps {
  className?: string
  histories: EditRecordItem[]
  pagination: PaginatedMeta
  onPageChange: (page: number) => void
  loading?: boolean
}

export const History = ({
  className,
  histories,
  pagination,
  onPageChange,
  loading = false,
}: HistoryProps) => {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {histories.map(history => (
        <HistoryItem key={history.id} history={history} className="lg:w-4xl" />
      ))}
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={onPageChange}
        noRouteChange
        loading={loading}
        scrollToTop
      />
    </div>
  )
}

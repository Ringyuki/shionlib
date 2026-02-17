'use client'

import { AdminDownloadResourceReportItem } from '@/interfaces/admin/report.interface'
import { ReportListItem } from './ReportListItem'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'

interface ReportListProps {
  items?: AdminDownloadResourceReportItem[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function ReportList({ items, isLoading, onRefresh }: ReportListProps) {
  const t = useTranslations('Admin.Reports')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div
        className={cn(
          'flex h-40 items-center justify-center rounded-lg border',
          'bg-white/50 dark:bg-gray-900/50',
          'border-gray-200 dark:border-gray-800',
        )}
      >
        <p className="text-gray-500 dark:text-gray-400">{t('noReports')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <ReportListItem key={item.id} report={item} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

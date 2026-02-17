'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AdminDownloadResourceReportReason,
  AdminDownloadResourceReportStatus,
  AdminReportMaliciousLevel,
} from '@/interfaces/admin/report.interface'
import { useAdminReportList } from '@/components/admin/hooks/useAdminReports'
import { ReportListFilters } from './ReportListFilters'
import { ReportList } from './ReportList'
import { Pagination } from '@/components/common/content/Pagination'
import { Button } from '@/components/shionui/Button'
import { RotateCcw } from 'lucide-react'

interface AdminReportsClientProps {
  initialPage: number
}

export function AdminReportsClient({ initialPage }: AdminReportsClientProps) {
  const t = useTranslations('Admin.Reports')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [status, setStatus] = useState<AdminDownloadResourceReportStatus | undefined>(undefined)
  const [reason, setReason] = useState<AdminDownloadResourceReportReason | undefined>(undefined)
  const [maliciousLevel, setMaliciousLevel] = useState<AdminReportMaliciousLevel | undefined>(
    undefined,
  )
  const [resourceId, setResourceId] = useState<number | undefined>(undefined)
  const [reporterId, setReporterId] = useState<number | undefined>(undefined)
  const [reportedUserId, setReportedUserId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'id' | 'created' | 'updated' | 'processed_at'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      status,
      reason,
      malicious_level: maliciousLevel,
      resource_id: resourceId,
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      sortBy,
      sortOrder,
    }),
    [
      page,
      pageSize,
      status,
      reason,
      maliciousLevel,
      resourceId,
      reporterId,
      reportedUserId,
      sortBy,
      sortOrder,
    ],
  )

  const { data, isLoading, refetch } = useAdminReportList(query)

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [status, reason, maliciousLevel, resourceId, reporterId, reportedUserId, sortBy, sortOrder])

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportListFilters
          status={status}
          onStatusChange={setStatus}
          reason={reason}
          onReasonChange={setReason}
          maliciousLevel={maliciousLevel}
          onMaliciousLevelChange={setMaliciousLevel}
          resourceId={resourceId}
          onResourceIdChange={setResourceId}
          reporterId={reporterId}
          onReporterIdChange={setReporterId}
          reportedUserId={reportedUserId}
          onReportedUserIdChange={setReportedUserId}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />

        <Button
          intent="neutral"
          appearance="ghost"
          onClick={refetch}
          loading={isLoading}
          renderIcon={<RotateCcw className="size-4" />}
        >
          {t('refresh')}
        </Button>
      </div>

      <ReportList items={data?.items} isLoading={isLoading} onRefresh={refetch} />

      <Pagination
        currentPage={data?.meta.currentPage ?? 1}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={isLoading}
        scrollToTop
        smoothScroll={false}
      />
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  useAdminSponsorList,
  getAdminSponsorStats,
} from '@/components/admin/hooks/useAdminSponsors'
import { SponsorOrderListFilters } from './SponsorOrderListFilters'
import { SponsorOrderList } from './SponsorOrderList'
import { Pagination } from '@/components/common/content/Pagination'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import { RotateCcw } from 'lucide-react'
import type { AdminSponsorStats } from '@/interfaces/admin/sponsor.interface'

interface AdminSponsorsClientProps {
  initialPage: number
}

export function AdminSponsorsClient({ initialPage }: AdminSponsorsClientProps) {
  const t = useTranslations('Admin.Sponsors')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [stats, setStats] = useState<AdminSponsorStats | null>(null)

  const query = useMemo(() => ({ page, limit: pageSize, status }), [page, pageSize, status])

  const { data, isLoading, refetch } = useAdminSponsorList(query)

  useEffect(() => {
    getAdminSponsorStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [status])

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SponsorOrderListFilters status={status} onStatusChange={setStatus} />
          {stats && (
            <div className="flex items-center gap-2">
              <Badge appearance="soft" intent="success">
                {t('totalSponsors')}: {stats.totalSponsors}
              </Badge>
              <Badge appearance="soft" intent="info">
                {t('totalAmount')}: ${stats.totalAmount}
              </Badge>
            </div>
          )}
        </div>
        <Button
          appearance="outline"
          size="sm"
          onClick={refetch}
          loading={isLoading}
          renderIcon={<RotateCcw />}
        >
          {t('refresh')}
        </Button>
      </div>

      <SponsorOrderList items={data?.items} isLoading={isLoading} />

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

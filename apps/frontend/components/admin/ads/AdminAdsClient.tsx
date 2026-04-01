'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminAdList } from '@/components/admin/hooks/useAdminAds'
import { AdListFilters } from './AdListFilters'
import { AdList } from './AdList'
import { AdFormDialog } from './AdFormDialog'
import { Pagination } from '@/components/common/content/Pagination'
import { Button } from '@/components/shionui/Button'
import { RotateCcw, Plus } from 'lucide-react'

interface AdminAdsClientProps {
  initialPage: number
}

export function AdminAdsClient({ initialPage }: AdminAdsClientProps) {
  const t = useTranslations('Admin.Ads')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [placement, setPlacement] = useState<string | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)

  const query = useMemo(
    () => ({ page, pageSize, placement, enabled }),
    [page, pageSize, placement, enabled],
  )

  const { data, isLoading, refetch } = useAdminAdList(query)

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [placement, enabled])

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdListFilters
          placement={placement}
          onPlacementChange={setPlacement}
          enabled={enabled}
          onEnabledChange={setEnabled}
        />
        <div className="flex items-center gap-2">
          <Button
            appearance="outline"
            size="sm"
            onClick={refetch}
            loading={isLoading}
            renderIcon={<RotateCcw />}
          >
            {t('refresh')}
          </Button>
          <Button
            intent="primary"
            size="sm"
            onClick={() => setCreateOpen(true)}
            renderIcon={<Plus />}
          >
            {t('createAd')}
          </Button>
        </div>
      </div>

      <AdList items={data?.items} isLoading={isLoading} onRefresh={refetch} />

      <Pagination
        currentPage={data?.meta.currentPage ?? 1}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={isLoading}
        scrollToTop
        smoothScroll={false}
      />

      <AdFormDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={refetch} />
    </div>
  )
}

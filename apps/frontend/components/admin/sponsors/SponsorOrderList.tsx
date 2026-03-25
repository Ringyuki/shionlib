'use client'

import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/shionui/Skeleton'
import { SponsorOrderListItem } from './SponsorOrderListItem'
import type { AdminSponsorOrderItem } from '@/interfaces/admin/sponsor.interface'

interface SponsorOrderListProps {
  items: AdminSponsorOrderItem[] | undefined
  isLoading: boolean
  onRefresh?: () => void
}

export function SponsorOrderList({ items, isLoading, onRefresh }: SponsorOrderListProps) {
  const t = useTranslations('Admin.Sponsors')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        {t('noOrders')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(order => (
        <SponsorOrderListItem key={order.id} order={order} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

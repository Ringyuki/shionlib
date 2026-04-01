'use client'

import { useTranslations } from 'next-intl'
import { Skeleton } from '@/components/shionui/Skeleton'
import { AdListItem } from './AdListItem'
import type { AdminAdItem } from '@/interfaces/admin/ad.interface'

interface AdListProps {
  items: AdminAdItem[] | undefined
  isLoading: boolean
  onRefresh: () => void
}

export function AdList({ items, isLoading, onRefresh }: AdListProps) {
  const t = useTranslations('Admin.Ads')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        {t('noAds')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(ad => (
        <AdListItem key={ad.id} ad={ad} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

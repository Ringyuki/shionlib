'use client'

import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'
import { AdminWalkthroughItem } from '@/interfaces/admin/walkthrough.interface'
import { WalkthroughListItem } from './WalkthroughListItem'

interface WalkthroughListProps {
  items?: AdminWalkthroughItem[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function WalkthroughList({ items, isLoading, onRefresh }: WalkthroughListProps) {
  const t = useTranslations('Admin.Walkthroughs')

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
        <p className="text-gray-500 dark:text-gray-400">{t('noWalkthroughs')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(walkthrough => (
        <WalkthroughListItem key={walkthrough.id} walkthrough={walkthrough} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

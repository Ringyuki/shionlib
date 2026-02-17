'use client'

import { AdminCommentItem } from '@/interfaces/admin/comment.interface'
import { CommentListItem } from './CommentListItem'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'

interface CommentListProps {
  items?: AdminCommentItem[]
  isLoading?: boolean
  onRefresh?: () => void
}

export function CommentList({ items, isLoading, onRefresh }: CommentListProps) {
  const t = useTranslations('Admin.Comments')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
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
        <p className="text-gray-500 dark:text-gray-400">{t('noComments')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(comment => (
        <CommentListItem key={comment.id} comment={comment} onRefresh={onRefresh} />
      ))}
    </div>
  )
}

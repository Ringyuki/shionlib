'use client'

import { AdminUserItem } from '@/interfaces/admin/user.interface'
import { UserListItem } from './UserListItem'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'

interface UserListProps {
  items?: AdminUserItem[]
  isLoading?: boolean
  currentRole: number
  currentUserId: number
  onRefresh?: () => void
}

export function UserList({
  items,
  isLoading,
  currentRole,
  currentUserId,
  onRefresh,
}: UserListProps) {
  const t = useTranslations('Admin.Users')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
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
        <p className="text-gray-500 dark:text-gray-400">{t('noUsers')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(user => (
        <UserListItem
          key={user.id}
          user={user}
          currentRole={currentRole}
          currentUserId={currentUserId}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}

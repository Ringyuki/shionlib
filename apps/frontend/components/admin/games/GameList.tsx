'use client'

import { AdminGameListItem } from '@/interfaces/admin/content.interface'
import { GameListItem } from './GameListItem'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'

interface GameListProps {
  items?: AdminGameListItem[]
  isLoading?: boolean
  onStatusChange?: (gameId: number, status: number) => void
  onDelete?: (gameId: number) => Promise<void>
  onAddRecentUpdate?: (gameId: number) => Promise<void>
  onRemoveRecentUpdate?: (gameId: number) => Promise<void>
}

export function GameList({
  items,
  isLoading,
  onStatusChange,
  onDelete,
  onAddRecentUpdate,
  onRemoveRecentUpdate,
}: GameListProps) {
  const t = useTranslations('Admin.Games')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
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
        <p className="text-gray-500 dark:text-gray-400">{t('noGames')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(game => (
        <GameListItem
          key={game.id}
          game={game}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onAddRecentUpdate={onAddRecentUpdate}
          onRemoveRecentUpdate={onRemoveRecentUpdate}
        />
      ))}
    </div>
  )
}

'use client'

import { AdminGameListItem } from '@/interfaces/admin/content.interface'
import { cn } from '@/utils/cn'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Link } from '@/i18n/navigation.client'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import {
  MoreHorizontal,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Trash2,
  CalendarPlus,
  CalendarX2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shionui/DropdownMenu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shionui/AlertDialog'
import { useState } from 'react'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { timeFormat } from '@/utils/time-format'
import { GameData } from '@/interfaces/game/game.interface'

interface GameListItemProps {
  game: AdminGameListItem
  onStatusChange?: (gameId: number, status: number) => void
  onDelete?: (gameId: number) => Promise<void>
  onAddRecentUpdate?: (gameId: number) => Promise<void>
  onRemoveRecentUpdate?: (gameId: number) => Promise<void>
}

export function GameListItem({
  game,
  onStatusChange,
  onDelete,
  onAddRecentUpdate,
  onRemoveRecentUpdate,
}: GameListItemProps) {
  const t = useTranslations('Admin.Games')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return
    try {
      setIsBusy(true)
      await onDelete(game.id)
      setDeleteOpen(false)
    } finally {
      setIsBusy(false)
    }
  }

  const handleAddRecentUpdate = async () => {
    if (!onAddRecentUpdate) return
    try {
      setIsBusy(true)
      await onAddRecentUpdate(game.id)
    } finally {
      setIsBusy(false)
    }
  }

  const handleRemoveRecentUpdate = async () => {
    if (!onRemoveRecentUpdate) return
    try {
      setIsBusy(true)
      await onRemoveRecentUpdate(game.id)
    } finally {
      setIsBusy(false)
    }
  }

  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { title } = getPreferredContent(game as unknown as GameData, 'title', lang)

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-4 rounded-lg border p-4 transition-colors',
          'bg-white/50 dark:bg-gray-900/50',
          'border-gray-200 dark:border-gray-800',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        )}
      >
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700">
          {game.cover ? (
            <FadeImage src={game.cover} alt={title} imageClassName="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">?</div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className=" font-medium">{title}</span>
            {game.nsfw && (
              <Badge variant="warning" className="shrink-0">
                NSFW
              </Badge>
            )}
            <Badge variant={game.status === 1 ? 'success' : 'neutral'} className="shrink-0">
              {game.status === 1 ? t('visible') : t('hidden')}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
            <span>ID: {game.id}</span>
            <span>
              {t('creator')}: {game.creator.name}
            </span>
            <span>
              {t('views')}: {game.views.toLocaleString()}
            </span>
            <span>
              {t('downloads')}: {game.downloads.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('created')}: {timeFormat(game.created, locale)} | {t('updated')}:{' '}
            {timeFormat(game.updated, locale)}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/game/${game.id}`} target="_blank" rel="noreferrer">
            <Button
              intent="neutral"
              appearance="ghost"
              size="icon"
              renderIcon={<ExternalLink className="size-4" />}
            />
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                intent="neutral"
                appearance="ghost"
                size="icon"
                disabled={isBusy}
                renderIcon={<MoreHorizontal className="size-4" />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild disabled={isBusy}>
                <Link href={`/admin/games/${game.id}/edit`}>
                  <Pencil className="mr-2 size-4" />
                  {t('edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange?.(game.id, game.status === 1 ? 2 : 1)}
                disabled={isBusy}
              >
                {game.status === 1 ? (
                  <>
                    <EyeOff className="mr-2 size-4" />
                    {t('hide')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 size-4" />
                    {t('show')}
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddRecentUpdate} disabled={isBusy}>
                <CalendarPlus className="mr-2 size-4" />
                {t('addRecentUpdate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemoveRecentUpdate} disabled={isBusy}>
                <CalendarX2 className="mr-2 size-4" />
                {t('removeRecentUpdate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} disabled={isBusy}>
                <Trash2 className="mr-2 size-4 text-destructive" />
                <span className="text-destructive">{t('delete')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle tone="destructive">{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="destructive" onClick={handleDelete} loading={isBusy}>
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

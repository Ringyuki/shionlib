'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
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
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { LanguageNameMap } from '@/interfaces/game/game.interface'
import {
  AdminWalkthroughItem,
  AdminWalkthroughStatus,
} from '@/interfaces/admin/walkthrough.interface'
import {
  rescanAdminWalkthrough,
  updateAdminWalkthroughStatus,
} from '@/components/admin/hooks/useAdminWalkthroughs'
import { WalkthroughDetailDialog } from './WalkthroughDetailDialog'

interface WalkthroughListItemProps {
  walkthrough: AdminWalkthroughItem
  onRefresh?: () => void
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getGameTitle = (walkthrough: AdminWalkthroughItem) =>
  walkthrough.game.title_zh || walkthrough.game.title_en || walkthrough.game.title_jp || null

export function WalkthroughListItem({ walkthrough, onRefresh }: WalkthroughListItemProps) {
  const t = useTranslations('Admin.Walkthroughs')
  const locale = useLocale()
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const statusLabel = useMemo(() => {
    if (walkthrough.status === 'PUBLISHED') return t('published')
    if (walkthrough.status === 'DRAFT') return t('draft')
    if (walkthrough.status === 'HIDDEN') return t('hidden')
    return t('deleted')
  }, [walkthrough.status, t])

  const statusIntent = useMemo(() => {
    if (walkthrough.status === 'PUBLISHED') return 'success' as const
    if (walkthrough.status === 'DELETED') return 'destructive' as const
    return 'warning' as const
  }, [walkthrough.status])

  const moderationLabel = useMemo(() => {
    if (!walkthrough.moderation) return null
    if (walkthrough.moderation.decision === 'ALLOW') return t('decisionAllow')
    if (walkthrough.moderation.decision === 'BLOCK') return t('decisionBlock')
    return t('decisionReview')
  }, [walkthrough.moderation, t])

  const moderationVariant = useMemo(() => {
    if (!walkthrough.moderation) return 'neutral' as const
    if (walkthrough.moderation.decision === 'ALLOW') return 'success' as const
    if (walkthrough.moderation.decision === 'BLOCK') return 'destructive' as const
    return 'warning' as const
  }, [walkthrough.moderation])

  const handleUpdateStatus = async (status: AdminWalkthroughStatus) => {
    setIsBusy(true)
    try {
      await updateAdminWalkthroughStatus(walkthrough.id, { status })
      toast.success(t('statusUpdated'))
      setDeleteOpen(false)
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleRescan = async () => {
    setIsBusy(true)
    try {
      await rescanAdminWalkthrough(walkthrough.id)
      toast.success(t('rescanQueued'))
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const gameTitle = getGameTitle(walkthrough)

  return (
    <div
      data-testid={`admin-walkthrough-row-${walkthrough.id}`}
      className={cn(
        'rounded-lg border p-4 transition-colors',
        'bg-white/50 dark:bg-gray-900/50',
        'border-gray-200 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3 min-w-0">
          <Avatar
            clickable={false}
            user={{
              id: walkthrough.creator.id,
              name: walkthrough.creator.name,
              avatar: walkthrough.creator.avatar ?? '',
            }}
            className="size-10"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                {walkthrough.title}
              </span>
              <Badge intent={statusIntent} appearance="solid">
                {statusLabel}
              </Badge>
              {walkthrough.edited && (
                <Badge intent="neutral" appearance="outline">
                  {t('edited')}
                </Badge>
              )}
              {walkthrough.lang && (
                <Badge intent="neutral" appearance="outline">
                  {LanguageNameMap[walkthrough.lang]}
                </Badge>
              )}
              {moderationLabel && (
                <Badge
                  intent={moderationVariant}
                  appearance={moderationVariant === 'neutral' ? 'outline' : 'solid'}
                >
                  {moderationLabel}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('walkthroughId')}: {walkthrough.id} · {t('creatorId')}: {walkthrough.creator.id}
            </div>
            {gameTitle ? (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('game')}: {gameTitle} · {t('gameId')}: {walkthrough.game.id}
              </div>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              intent="neutral"
              appearance="ghost"
              className="h-8 w-8 p-0"
              disabled={isBusy}
              data-testid={`admin-walkthrough-actions-trigger-${walkthrough.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            data-testid={`admin-walkthrough-actions-menu-${walkthrough.id}`}
          >
            <DropdownMenuItem
              onClick={() => setDetailOpen(true)}
              data-testid={`admin-walkthrough-action-view-detail-${walkthrough.id}`}
            >
              {t('viewDetail')}
            </DropdownMenuItem>
            {walkthrough.status !== 'PUBLISHED' && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus('PUBLISHED')}
                disabled={isBusy}
                data-testid={`admin-walkthrough-action-publish-${walkthrough.id}`}
              >
                {t('publish')}
              </DropdownMenuItem>
            )}
            {walkthrough.status !== 'DRAFT' && walkthrough.status !== 'DELETED' && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus('DRAFT')}
                disabled={isBusy}
                data-testid={`admin-walkthrough-action-draft-${walkthrough.id}`}
              >
                {t('saveDraft')}
              </DropdownMenuItem>
            )}
            {walkthrough.status !== 'HIDDEN' && walkthrough.status !== 'DELETED' && (
              <DropdownMenuItem
                onClick={() => handleUpdateStatus('HIDDEN')}
                disabled={isBusy}
                data-testid={`admin-walkthrough-action-hide-${walkthrough.id}`}
              >
                {t('hide')}
              </DropdownMenuItem>
            )}
            {walkthrough.status !== 'DELETED' && (
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                disabled={isBusy}
                data-testid={`admin-walkthrough-action-delete-${walkthrough.id}`}
              >
                {t('delete')}
              </DropdownMenuItem>
            )}
            {walkthrough.status !== 'DELETED' && (
              <DropdownMenuItem
                onClick={handleRescan}
                disabled={isBusy}
                data-testid={`admin-walkthrough-action-rescan-${walkthrough.id}`}
              >
                {t('rescan')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="mt-3 text-sm prose prose-sm dark:prose-invert max-w-none line-clamp-3"
        dangerouslySetInnerHTML={{ __html: walkthrough.html || '' }}
      />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t('created')}: {formatDate(walkthrough.created, locale)}
        </span>
        <span>
          {t('updated')}: {formatDate(walkthrough.updated, locale)}
        </span>
      </div>

      <WalkthroughDetailDialog
        walkthroughId={detailOpen ? walkthrough.id : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-testid={`admin-walkthrough-delete-dialog-${walkthrough.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUpdateStatus('DELETED')}
              data-testid={`admin-walkthrough-delete-confirm-${walkthrough.id}`}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

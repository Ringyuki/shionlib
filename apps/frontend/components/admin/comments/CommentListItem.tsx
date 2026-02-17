'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminCommentItem } from '@/interfaces/admin/comment.interface'
import { cn } from '@/utils/cn'
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
import {
  rescanAdminComment,
  updateAdminCommentStatus,
} from '@/components/admin/hooks/useAdminComments'
import { CommentDetailDialog } from './CommentDetailDialog'
import { toast } from 'react-hot-toast'
import { MoreHorizontal } from 'lucide-react'

interface CommentListItemProps {
  comment: AdminCommentItem
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

const getGameTitle = (comment: AdminCommentItem) => {
  if (!comment.game) return null
  return comment.game.title_zh || comment.game.title_en || comment.game.title_jp || null
}

export function CommentListItem({ comment, onRefresh }: CommentListItemProps) {
  const t = useTranslations('Admin.Comments')
  const locale = useLocale()
  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)

  const statusLabel = useMemo(() => {
    if (comment.status === 1) return t('visible')
    if (comment.status === 2) return t('pending')
    return t('deleted')
  }, [comment.status, t])

  const moderationLabel = useMemo(() => {
    if (!comment.moderation) return null
    if (comment.moderation.decision === 'ALLOW') return t('decisionAllow')
    if (comment.moderation.decision === 'BLOCK') return t('decisionBlock')
    return t('decisionReview')
  }, [comment.moderation, t])

  const moderationVariant = useMemo(() => {
    if (!comment.moderation) return 'neutral' as const
    if (comment.moderation.decision === 'ALLOW') return 'success' as const
    if (comment.moderation.decision === 'BLOCK') return 'destructive' as const
    return 'warning' as const
  }, [comment.moderation])

  const handleUpdateStatus = async (status: number) => {
    setIsBusy(true)
    try {
      await updateAdminCommentStatus(comment.id, {
        status,
        notify: status === 3 ? false : undefined,
      })
      toast.success(t('statusUpdated'))
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleRescan = async () => {
    setIsBusy(true)
    try {
      await rescanAdminComment(comment.id)
      toast.success(t('rescanQueued'))
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const gameTitle = getGameTitle(comment)

  return (
    <div
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
              id: comment.creator.id,
              name: comment.creator.name,
              avatar: comment.creator.avatar ?? '',
            }}
            className="size-10"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                {comment.creator.name}
              </span>
              <Badge
                variant={
                  comment.status === 1
                    ? 'success'
                    : comment.status === 2
                      ? 'warning'
                      : 'destructive'
                }
              >
                {statusLabel}
              </Badge>
              {comment.edited && <Badge variant="neutral">{t('edited')}</Badge>}
              {moderationLabel && <Badge variant={moderationVariant}>{moderationLabel}</Badge>}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('commentId')}: {comment.id} · {t('creatorId')}: {comment.creator.id}
            </div>
            {gameTitle && comment.game ? (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('game')}: {gameTitle} · {t('gameId')}: {comment.game.id}
              </div>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button intent="neutral" appearance="ghost" className="h-8 w-8 p-0" disabled={isBusy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDetailOpen(true)}>
              {t('viewDetail')}
            </DropdownMenuItem>
            {comment.status !== 1 && (
              <DropdownMenuItem onClick={() => handleUpdateStatus(1)} disabled={isBusy}>
                {comment.status === 3 ? t('restore') : t('approve')}
              </DropdownMenuItem>
            )}
            {comment.status !== 2 && (
              <DropdownMenuItem onClick={() => handleUpdateStatus(2)} disabled={isBusy}>
                {t('hide')}
              </DropdownMenuItem>
            )}
            {comment.status !== 3 && (
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} disabled={isBusy}>
                {t('delete')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleRescan} disabled={isBusy}>
              {t('rescan')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {comment.parent ? (
        <div className="mt-3 rounded-md border border-dashed bg-gray-50/70 dark:bg-gray-900/40 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {t('parentComment')}:{' '}
          </span>
          <span
            className="block prose prose-sm dark:prose-invert max-w-none line-clamp-2"
            dangerouslySetInnerHTML={{ __html: comment.parent.html || '' }}
          />
        </div>
      ) : null}

      <div
        className="mt-3 text-sm prose prose-sm dark:prose-invert max-w-none line-clamp-3"
        dangerouslySetInnerHTML={{ __html: comment.html || '' }}
      />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          {t('replyCount')}: {comment.reply_count}
        </span>
        <span>
          {t('likeCount')}: {comment.like_count}
        </span>
        <span>
          {t('created')}: {formatDate(comment.created, locale)}
        </span>
        <span>
          {t('updated')}: {formatDate(comment.updated, locale)}
        </span>
      </div>

      <CommentDetailDialog
        commentId={detailOpen ? comment.id : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleUpdateStatus(3)}>
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

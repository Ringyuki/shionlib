'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import { Badge } from '@/components/shionui/Badge'
import { Skeleton } from '@/components/shionui/Skeleton'
import { Separator } from '@/components/shionui/Separator'
import { AdminCommentDetail } from '@/interfaces/admin/comment.interface'
import { getAdminCommentDetail } from '@/components/admin/hooks/useAdminComments'
import { cn } from '@/utils/cn'

interface CommentDetailDialogProps {
  commentId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale)
}

const getGameTitle = (detail: AdminCommentDetail | null) => {
  if (!detail?.game) return null
  return detail.game.title_zh || detail.game.title_en || detail.game.title_jp || null
}

export function CommentDetailDialog({ commentId, open, onOpenChange }: CommentDetailDialogProps) {
  const t = useTranslations('Admin.Comments')
  const locale = useLocale()
  const [detail, setDetail] = useState<AdminCommentDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const statusLabel = useMemo(() => {
    if (!detail) return ''
    if (detail.status === 1) return t('visible')
    if (detail.status === 2) return t('pending')
    return t('deleted')
  }, [detail, t])

  const loadDetail = async (id: number) => {
    setLoading(true)
    try {
      const data = await getAdminCommentDetail(id)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !commentId) return
    loadDetail(commentId)
  }, [open, commentId])

  const gameTitle = getGameTitle(detail)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fitContent className="min-w-full sm:min-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('detailTitle')}</DialogTitle>
          <DialogDescription>{t('detailDescription')}</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-80" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  detail.status === 1 ? 'success' : detail.status === 2 ? 'warning' : 'destructive'
                }
              >
                {statusLabel}
              </Badge>
              {detail.edited && <Badge variant="neutral">{t('edited')}</Badge>}
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <div>
                {t('commentId')}: {detail.id}
              </div>
              <div>
                {t('creatorId')}: {detail.creator.id} · {detail.creator.name}
              </div>
              {gameTitle && detail.game ? (
                <div>
                  {t('game')}: {gameTitle} · {t('gameId')}: {detail.game.id}
                </div>
              ) : null}
              <div>
                {t('created')}: {formatDate(detail.created, locale)}
              </div>
              <div>
                {t('updated')}: {formatDate(detail.updated, locale)}
              </div>
            </div>

            {detail.parent ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{t('parentComment')}</div>
                <div
                  className="mt-2 text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: detail.parent.html || '' }}
                />
              </div>
            ) : null}

            <div className="rounded-lg border p-3">
              <div className="font-medium">{t('commentContent')}</div>
              <div
                className="mt-2 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: detail.html || '' }}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-medium">{t('rawContent')}</div>
              <pre
                className={cn(
                  'rounded-md border bg-gray-50/70 dark:bg-gray-900/40 p-3 text-xs',
                  'max-h-64 overflow-auto',
                )}
              >
                {detail.content ? JSON.stringify(detail.content, null, 2) : t('empty')}
              </pre>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-medium">{t('moderationTitle')}</div>
              {detail.moderations.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('noModeration')}</div>
              ) : (
                <div className="space-y-2">
                  {detail.moderations.map(event => (
                    <div key={event.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{event.model}</Badge>
                        <Badge
                          variant={
                            event.decision === 'ALLOW'
                              ? 'success'
                              : event.decision === 'BLOCK'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {event.decision === 'ALLOW'
                            ? t('decisionAllow')
                            : event.decision === 'BLOCK'
                              ? t('decisionBlock')
                              : t('decisionReview')}
                        </Badge>
                        <Badge variant="neutral">{event.top_category}</Badge>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        {t('moderationAuditBy')}: {event.audit_by}
                      </div>
                      <div className="text-muted-foreground">
                        {t('moderationTime')}: {formatDate(event.created_at, locale)}
                      </div>
                      {event.max_score != null ? (
                        <div className="text-muted-foreground">
                          {t('moderationMaxScore')}: {event.max_score}
                        </div>
                      ) : null}
                      {event.reason ? (
                        <div className="text-muted-foreground">
                          {t('moderationReason')}: {event.reason}
                        </div>
                      ) : null}
                      {event.evidence ? (
                        <div className="text-muted-foreground">
                          {t('moderationEvidence')}: {event.evidence}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

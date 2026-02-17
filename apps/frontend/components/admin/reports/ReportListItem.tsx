'use client'

import { useLocale, useTranslations } from 'next-intl'
import { AdminDownloadResourceReportItem } from '@/interfaces/admin/report.interface'
import { cn } from '@/utils/cn'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { ReportDetailDialog } from './ReportDetailDialog'
import { useMemo, useState } from 'react'

interface ReportListItemProps {
  report: AdminDownloadResourceReportItem
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

const getGameTitle = (report: AdminDownloadResourceReportItem) => {
  if (!report.resource.game) return null
  return (
    report.resource.game.title_zh ||
    report.resource.game.title_en ||
    report.resource.game.title_jp ||
    null
  )
}

export function ReportListItem({ report, onRefresh }: ReportListItemProps) {
  const t = useTranslations('Admin.Reports')
  const locale = useLocale()
  const [detailOpen, setDetailOpen] = useState(false)

  const statusVariant = useMemo(() => {
    if (report.status === 'PENDING') return 'warning' as const
    if (report.status === 'VALID') return 'success' as const
    return 'destructive' as const
  }, [report.status])

  const levelVariant = useMemo(() => {
    if (report.malicious_level === 'LOW') return 'neutral' as const
    if (report.malicious_level === 'MEDIUM') return 'info' as const
    if (report.malicious_level === 'HIGH') return 'warning' as const
    return 'destructive' as const
  }, [report.malicious_level])

  const gameTitle = getGameTitle(report)

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
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {t('reportId')}: {report.id}
            </span>
            <Badge variant={statusVariant}>{t(`statuses.${report.status}`)}</Badge>
            <Badge variant="neutral">{t(`reasons.${report.reason}`)}</Badge>
            <Badge variant={levelVariant}>{t(`levels.${report.malicious_level}`)}</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-2">
              <Avatar
                clickable={false}
                user={{
                  id: report.reporter.id,
                  name: report.reporter.name,
                  avatar: report.reporter.avatar ?? '',
                }}
                className="size-7"
              />
              <span>
                {t('reporter')}: {report.reporter.name} ({report.reporter.id})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar
                clickable={false}
                user={{
                  id: report.reported_user.id,
                  name: report.reported_user.name,
                  avatar: report.reported_user.avatar ?? '',
                }}
                className="size-7"
              />
              <span>
                {t('reportedUser')}: {report.reported_user.name} ({report.reported_user.id})
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('resourceId')}: {report.resource.id} · {t('gameId')}: {report.resource.game_id}
            {gameTitle ? ` · ${t('game')}: ${gameTitle}` : ''}
          </div>

          {report.detail ? (
            <div className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
              {report.detail}
            </div>
          ) : (
            <div className="text-sm text-gray-400">{t('noDetail')}</div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('created')}: {formatDate(report.created, locale)}
            </span>
            <span>
              {t('updated')}: {formatDate(report.updated, locale)}
            </span>
            <span>
              {t('processedAt')}: {formatDate(report.processed_at, locale)}
            </span>
            {report.processor ? (
              <span>
                {t('processedBy')}: {report.processor.name} ({report.processor.id})
              </span>
            ) : null}
          </div>
        </div>

        <Button intent="neutral" appearance="ghost" onClick={() => setDetailOpen(true)}>
          {t('viewDetail')}
        </Button>
      </div>

      <ReportDetailDialog
        reportId={detailOpen ? report.id : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onReviewed={onRefresh}
      />
    </div>
  )
}

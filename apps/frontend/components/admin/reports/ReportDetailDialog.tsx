'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import { Badge } from '@/components/shionui/Badge'
import { Skeleton } from '@/components/shionui/Skeleton'
import { Separator } from '@/components/shionui/Separator'
import { Textarea } from '@/components/shionui/Textarea'
import { Label } from '@/components/shionui/Label'
import { Checkbox } from '@/components/shionui/Checkbox'
import { Button } from '@/components/shionui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import {
  AdminDownloadResourceReportDetail,
  AdminDownloadResourceReportVerdict,
  AdminReportMaliciousLevel,
} from '@/interfaces/admin/report.interface'
import { getAdminReportDetail, reviewAdminReport } from '@/components/admin/hooks/useAdminReports'
import { formatBytes } from '@/utils/format'
import { toast } from 'react-hot-toast'

interface ReportDetailDialogProps {
  reportId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReviewed?: () => void
}

const maliciousLevels: AdminReportMaliciousLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale)
}

const getGameTitle = (detail: AdminDownloadResourceReportDetail | null) => {
  if (!detail?.resource.game) return null
  return (
    detail.resource.game.title_zh ||
    detail.resource.game.title_en ||
    detail.resource.game.title_jp ||
    null
  )
}

export function ReportDetailDialog({
  reportId,
  open,
  onOpenChange,
  onReviewed,
}: ReportDetailDialogProps) {
  const t = useTranslations('Admin.Reports')
  const locale = useLocale()
  const [detail, setDetail] = useState<AdminDownloadResourceReportDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [verdict, setVerdict] = useState<AdminDownloadResourceReportVerdict>('VALID')
  const [maliciousLevel, setMaliciousLevel] = useState<AdminReportMaliciousLevel>('MEDIUM')
  const [processNote, setProcessNote] = useState('')
  const [notify, setNotify] = useState(true)

  const loadDetail = async (id: number) => {
    setLoading(true)
    try {
      const data = await getAdminReportDetail(id)
      setDetail(data)
      setMaliciousLevel(data.malicious_level)
      setProcessNote(data.process_note ?? '')
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !reportId) return
    setVerdict('VALID')
    setNotify(true)
    setProcessNote('')
    loadDetail(reportId)
  }, [open, reportId])

  const statusVariant = useMemo(() => {
    if (!detail) return 'neutral' as const
    if (detail.status === 'PENDING') return 'warning' as const
    if (detail.status === 'VALID') return 'success' as const
    return 'destructive' as const
  }, [detail])

  const levelVariant = useMemo(() => {
    if (!detail) return 'neutral' as const
    if (detail.malicious_level === 'LOW') return 'neutral' as const
    if (detail.malicious_level === 'MEDIUM') return 'info' as const
    if (detail.malicious_level === 'HIGH') return 'warning' as const
    return 'destructive' as const
  }, [detail])

  const handleReview = async () => {
    if (!detail || detail.status !== 'PENDING') return

    setIsBusy(true)
    try {
      const reviewed = await reviewAdminReport(detail.id, {
        verdict,
        malicious_level: verdict === 'VALID' ? maliciousLevel : undefined,
        process_note: processNote.trim() || undefined,
        notify,
      })
      setDetail(reviewed)
      toast.success(t('reviewSaved'))
      onReviewed?.()
      onOpenChange(false)
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

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
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-6 w-80" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant}>{t(`statuses.${detail.status}`)}</Badge>
              <Badge variant="neutral">{t(`reasons.${detail.reason}`)}</Badge>
              <Badge variant={levelVariant}>{t(`levels.${detail.malicious_level}`)}</Badge>
              {detail.reported_penalty_applied && (
                <Badge variant="warning">{t('reportedPenaltyApplied')}</Badge>
              )}
              {detail.reporter_penalty_applied && (
                <Badge variant="destructive">{t('reporterPenaltyApplied')}</Badge>
              )}
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <div>
                {t('reportId')}: {detail.id}
              </div>
              <div>
                {t('resourceId')}: {detail.resource.id} · {t('gameId')}: {detail.resource.game_id}
              </div>
              {gameTitle ? (
                <div>
                  {t('game')}: {gameTitle}
                </div>
              ) : null}
              <div>
                {t('reporter')}: {detail.reporter.name} ({detail.reporter.id})
              </div>
              <div>
                {t('reportedUser')}: {detail.reported_user.name} ({detail.reported_user.id})
              </div>
              <div>
                {t('created')}: {formatDate(detail.created, locale)}
              </div>
              <div>
                {t('updated')}: {formatDate(detail.updated, locale)}
              </div>
              <div>
                {t('processedAt')}: {formatDate(detail.processed_at, locale)}
              </div>
              <div>
                {t('processedBy')}:{' '}
                {detail.processor ? `${detail.processor.name} (${detail.processor.id})` : '-'}
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{t('reportDetail')}</div>
              <div className="mt-2 text-muted-foreground whitespace-pre-wrap">
                {detail.detail || t('noDetail')}
              </div>
            </div>

            {detail.resource.note ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{t('resourceNote')}</div>
                <div className="mt-2 text-muted-foreground whitespace-pre-wrap">
                  {detail.resource.note}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="font-medium">{t('filesTitle')}</div>
              {detail.resource.files.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('noFiles')}</div>
              ) : (
                <div className="space-y-2">
                  {detail.resource.files.map(file => (
                    <div key={file.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium break-all">{file.file_name}</div>
                      <div className="mt-1 text-muted-foreground">
                        ID: {file.id} · {t('fileSize')}: {formatBytes(Number(file.file_size))}
                      </div>
                      <div className="text-muted-foreground">
                        file_status: {file.file_status} · file_check_status:{' '}
                        {file.file_check_status}
                      </div>
                      {file.file_hash ? (
                        <div className="text-muted-foreground break-all">
                          {file.hash_algorithm || 'HASH'}: {file.file_hash}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detail.process_note ? (
              <>
                <Separator />
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{t('processNote')}</div>
                  <div className="mt-2 text-muted-foreground whitespace-pre-wrap">
                    {detail.process_note}
                  </div>
                </div>
              </>
            ) : null}

            {detail.status === 'PENDING' ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="font-medium">{t('reviewTitle')}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t('verdict')}</Label>
                      <Select
                        value={verdict}
                        onValueChange={v => setVerdict(v as AdminDownloadResourceReportVerdict)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VALID">{t('verdictValid')}</SelectItem>
                          <SelectItem value="INVALID">{t('verdictInvalid')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t('maliciousLevel')}</Label>
                      <Select
                        value={maliciousLevel}
                        onValueChange={v => setMaliciousLevel(v as AdminReportMaliciousLevel)}
                        disabled={verdict === 'INVALID'}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {maliciousLevels.map(level => (
                            <SelectItem key={level} value={level}>
                              {t(`levels.${level}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('processNote')}</Label>
                    <Textarea
                      value={processNote}
                      onChange={e => setProcessNote(e.target.value)}
                      placeholder={t('processNotePlaceholder')}
                      rows={4}
                      maxLength={500}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={notify}
                      onCheckedChange={checked => setNotify(Boolean(checked))}
                    />
                    <span className="text-sm">{t('notifyUser')}</span>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    intent={verdict === 'VALID' ? 'warning' : 'destructive'}
                    onClick={handleReview}
                    loading={isBusy}
                  >
                    {t('submitReview')}
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

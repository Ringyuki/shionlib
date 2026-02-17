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
import {
  AdminUserDetail,
  AdminUserSession,
  AdminUserSessionsQuery,
} from '@/interfaces/admin/user.interface'
import { getAdminUserDetail, getAdminUserSessions } from '@/components/admin/hooks/useAdminUsers'
import { cn } from '@/utils/cn'
import { formatBytes } from '@/utils/format'

interface UserDetailDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale)
}

export function UserDetailDialog({ userId, open, onOpenChange }: UserDetailDialogProps) {
  const t = useTranslations('Admin.Users')
  const locale = useLocale()
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<AdminUserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  const roleLabel = useMemo(() => {
    if (!detail) return ''
    switch (detail.role) {
      case 1:
        return t('roleUser')
      case 2:
        return t('roleAdmin')
      case 3:
        return t('roleSuperAdmin')
      default:
        return String(detail.role)
    }
  }, [detail, t])

  const statusLabel = useMemo(() => {
    if (!detail) return ''
    return detail.status === 2 ? t('banned') : t('active')
  }, [detail, t])

  const loadDetail = async (id: number) => {
    setLoading(true)
    try {
      const data = await getAdminUserDetail(id)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  const loadSessions = async (id: number, query: AdminUserSessionsQuery = {}) => {
    setSessionsLoading(true)
    try {
      const data = await getAdminUserSessions(id, query)
      const now = Date.now()
      const recent = (data.items ?? []).filter(session => {
        if (session.status !== 1) return false
        const exp = new Date(session.expires_at).getTime()
        return !Number.isNaN(exp) && exp > now
      })
      setSessions(recent)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !userId) return
    loadDetail(userId)
    loadSessions(userId, { page: 1, limit: 5, status: 1 })
  }, [open, userId])

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
              <Badge variant={detail.status === 2 ? 'warning' : 'success'}>{statusLabel}</Badge>
              <Badge variant="neutral">{roleLabel}</Badge>
              {detail.two_factor_enabled ? (
                <Badge variant="success">{t('twoFactorOn')}</Badge>
              ) : (
                <Badge variant="neutral">{t('twoFactorOff')}</Badge>
              )}
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground">
              <div>
                {t('userId')}: {detail.id}
              </div>
              <div>
                {t('name')}: {detail.name}
              </div>
              <div>
                {t('email')}: {detail.email}
              </div>
              <div>
                {t('language')}: {detail.lang}
              </div>
              <div>
                {t('contentLimit')}: {detail.content_limit}
              </div>
              <div>
                {t('created')}: {formatDate(detail.created, locale)}
              </div>
              <div>
                {t('updated')}: {formatDate(detail.updated, locale)}
              </div>
              <div>
                {t('lastLogin')}: {formatDate(detail.last_login_at, locale)}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                {t('countResources')}: {detail.counts.resources}
              </div>
              <div>
                {t('countComments')}: {detail.counts.comments}
              </div>
              <div>
                {t('countFavorites')}: {detail.counts.favorites}
              </div>
              <div>
                {t('countEdits')}: {detail.counts.edits}
              </div>
            </div>

            {detail.upload_quota && (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{t('uploadQuota')}</div>
                <div className="text-muted-foreground">
                  {t('quotaSize')}: {formatBytes(Number(detail.upload_quota.size))}
                </div>
                <div className="text-muted-foreground">
                  {t('quotaUsed')}: {formatBytes(Number(detail.upload_quota.used))}
                </div>
                <div className="text-muted-foreground">
                  {t('quotaFirstGrant')}: {detail.upload_quota.is_first_grant ? t('yes') : t('no')}
                </div>
              </div>
            )}

            {detail.latest_ban ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{t('latestBan')}</div>
                <div className="text-muted-foreground">
                  {t('bannedAt')}: {formatDate(detail.latest_ban.banned_at, locale)}
                </div>
                <div className="text-muted-foreground">
                  {t('bannedReason')}: {detail.latest_ban.banned_reason || '-'}
                </div>
                <div className="text-muted-foreground">
                  {t('banDuration')}:{' '}
                  {detail.latest_ban.is_permanent
                    ? t('permanent')
                    : (detail.latest_ban.banned_duration_days ?? '-')}
                </div>
                <div className="text-muted-foreground">
                  {t('unbannedAt')}: {formatDate(detail.latest_ban.unbanned_at, locale)}
                </div>
                <div className="text-muted-foreground">
                  {t('bannedBy')}: {detail.latest_ban.banned_by?.name || '-'}
                </div>
              </div>
            ) : null}

            <Separator />

            <div className="space-y-2">
              <div className="font-medium">{t('sessionsTitle')}</div>
              {sessionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t('noSessions')}</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div key={session.id} className={cn('rounded-lg border p-3 text-sm')}>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="neutral">
                          {t('sessionId')}: {session.id}
                        </Badge>
                        <Badge variant={session.status === 1 ? 'success' : 'neutral'}>
                          {t('sessionStatus')}: {session.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        {t('sessionFamily')}: {session.family_id}
                      </div>
                      <div className="text-muted-foreground">
                        {t('sessionIp')}: {session.ip || '-'}
                      </div>
                      <div className="text-muted-foreground">
                        {t('sessionUserAgent')}: {session.user_agent || '-'}
                      </div>
                      <div className="text-muted-foreground">
                        {t('sessionUpdated')}: {formatDate(session.updated, locale)}
                      </div>
                      <div className="text-muted-foreground">
                        {t('sessionExpires')}: {formatDate(session.expires_at, locale)}
                      </div>
                      {session.blocked_reason ? (
                        <div className="text-muted-foreground">
                          {t('sessionBlockedReason')}: {session.blocked_reason}
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

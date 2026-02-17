'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import { Button } from '@/components/shionui/Button'
import { InputNumber } from '@/components/shionui/InputNumber'
import { Input } from '@/components/shionui/Input'
import { Separator } from '@/components/shionui/Separator'
import { Skeleton } from '@/components/shionui/Skeleton'
import {
  getAdminUserDetail,
  adminAdjustQuotaSize,
  adminAdjustQuotaUsed,
  adminResetQuotaUsed,
} from '@/components/admin/hooks/useAdminUsers'
import { AdminUserDetail } from '@/interfaces/admin/user.interface'
import { toast } from 'react-hot-toast'
import { formatBytes } from '@/utils/format'

interface UserQuotaDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function UserQuotaDialog({ userId, open, onOpenChange, onUpdated }: UserQuotaDialogProps) {
  const t = useTranslations('Admin.Users')
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sizeDelta, setSizeDelta] = useState<number | null>(null)
  const [usedDelta, setUsedDelta] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  const refresh = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getAdminUserDetail(userId)
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !userId) return
    refresh()
    setSizeDelta(null)
    setUsedDelta(null)
    setReason('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId])

  const currentSize = useMemo(() => formatBytes(Number(detail?.upload_quota?.size)), [detail])
  const currentUsed = useMemo(() => formatBytes(Number(detail?.upload_quota?.used)), [detail])

  const applySize = async (action: 'ADD' | 'SUB') => {
    if (!userId || !sizeDelta) return
    const amount = Math.round(sizeDelta * 1024 ** 3)
    if (amount <= 0) return
    setSaving(true)
    try {
      await adminAdjustQuotaSize(userId, {
        action,
        amount,
        action_reason: reason.trim() || undefined,
      })
      toast.success(t('quotaUpdated'))
      await refresh()
      // onUpdated?.()
      setSizeDelta(null)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const applyUsed = async (action: 'USE' | 'ADD') => {
    if (!userId || !usedDelta) return
    const amount = Math.round(usedDelta * 1024 ** 3)
    if (amount <= 0) return
    setSaving(true)
    try {
      await adminAdjustQuotaUsed(userId, {
        action,
        amount,
        action_reason: reason.trim() || undefined,
      })
      toast.success(t('quotaUpdated'))
      await refresh()
      // onUpdated?.()
      setUsedDelta(null)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const resetUsed = async () => {
    if (!userId) return
    setSaving(true)
    try {
      await adminResetQuotaUsed(userId)
      toast.success(t('quotaResetUsed'))
      await refresh()
      // onUpdated?.()
    } catch {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('quotaTitle')}</DialogTitle>
          <DialogDescription>{t('quotaDescription')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {t('quotaCurrentSize')}: {currentSize}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('quotaCurrentUsed')}: {currentUsed}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="font-medium">{t('quotaAdjustSize')}</div>
              <div className="flex flex-wrap items-center gap-3">
                <InputNumber
                  value={sizeDelta}
                  onChange={value => setSizeDelta(value)}
                  min={0.1}
                  step={0.1}
                  precision={2}
                  placeholder={t('quotaAmountGb')}
                />
                <Button intent="primary" onClick={() => applySize('ADD')} loading={saving}>
                  {t('quotaAdd')}
                </Button>
                <Button intent="warning" onClick={() => applySize('SUB')} loading={saving}>
                  {t('quotaSub')}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="font-medium">{t('quotaAdjustUsed')}</div>
              <div className="flex flex-wrap items-center gap-3">
                <InputNumber
                  value={usedDelta}
                  onChange={value => setUsedDelta(value)}
                  min={0.1}
                  step={0.1}
                  precision={2}
                  placeholder={t('quotaAmountGb')}
                />
                <Button intent="primary" onClick={() => applyUsed('USE')} loading={saving}>
                  {t('quotaUse')}
                </Button>
                <Button intent="warning" onClick={() => applyUsed('ADD')} loading={saving}>
                  {t('quotaRestore')}
                </Button>
                <Button intent="neutral" appearance="ghost" onClick={resetUsed} loading={saving}>
                  {t('quotaResetUsed')}
                </Button>
              </div>
            </div>

            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('quotaReason')}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

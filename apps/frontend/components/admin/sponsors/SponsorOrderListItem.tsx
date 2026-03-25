'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { cn } from '@/utils/cn'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  adminUpdateSponsorOrderStatus,
  adminDeleteSponsorOrder,
} from '@/components/admin/hooks/useAdminSponsors'
import { toast } from 'react-hot-toast'
import type { AdminSponsorOrderItem } from '@/interfaces/admin/sponsor.interface'

interface SponsorOrderListItemProps {
  order: AdminSponsorOrderItem
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

const STATUSES = ['NEW', 'DONE', 'EXPIRED', 'REFUND'] as const

export function SponsorOrderListItem({ order, onRefresh }: SponsorOrderListItemProps) {
  const t = useTranslations('Admin.Sponsors')
  const locale = useLocale()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const statusVariant = useMemo(() => {
    if (order.status === 'DONE') return 'success' as const
    if (order.status === 'NEW') return 'info' as const
    if (order.status === 'EXPIRED') return 'warning' as const
    return 'destructive' as const
  }, [order.status])

  const statusKey = `status${order.status.charAt(0) + order.status.slice(1).toLowerCase()}` as
    | 'statusNew'
    | 'statusDone'
    | 'statusExpired'
    | 'statusRefund'

  const displayName = order.sponsorName || order.user?.name || null

  const handleStatusChange = async (newStatus: string) => {
    try {
      await adminUpdateSponsorOrderStatus(order.id, newStatus)
      toast.success(t('statusUpdated'))
      onRefresh?.()
    } catch {
      toast.error(t('statusUpdateFailed'))
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await adminDeleteSponsorOrder(order.id)
      toast.success(t('orderDeleted'))
      onRefresh?.()
    } catch {
      toast.error(t('orderDeleteFailed'))
    } finally {
      setDeleteLoading(false)
      setDeleteOpen(false)
    }
  }

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
            <span className="font-medium text-gray-900 dark:text-gray-100">${order.amount}</span>
            <Badge intent={statusVariant} appearance="solid">
              {t(statusKey)}
            </Badge>
            {order.isPrivate && (
              <Badge intent="warning" appearance="soft">
                {t('private')}
              </Badge>
            )}
            {order.paymentMethod && (
              <Badge intent="neutral" appearance="outline">
                {order.paymentMethod}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {order.user ? (
              <Avatar
                clickable={false}
                user={{
                  id: order.user.id,
                  name: order.user.name,
                  avatar: order.user.avatar ?? '',
                  is_sponsor: order.user.is_sponsor,
                }}
                className="size-7"
              />
            ) : null}
            <span>
              {t('sponsor')}: {displayName || t('anonymous')}
              {order.user && order.sponsorName && order.sponsorName !== order.user.name
                ? ` (${order.user.name})`
                : ''}
              {order.user ? ` (${order.user.id})` : ''}
            </span>
          </div>

          {order.message && (
            <div className="text-sm text-gray-600 dark:text-gray-300 italic">{order.message}</div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('orderId')}: #{order.id} · {order.providerOrderId}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('createdAt')}: {formatDate(order.created, locale)}
            </span>
            <span>
              {t('paidAt')}: {formatDate(order.paidAt, locale)}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button intent="neutral" appearance="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {STATUSES.filter(s => s !== order.status).map(s => {
              const sKey = `status${s.charAt(0) + s.slice(1).toLowerCase()}` as
                | 'statusNew'
                | 'statusDone'
                | 'statusExpired'
                | 'statusRefund'
              return (
                <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                  {t('setStatus', { status: t(sKey) })}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
              {t('deleteOrder')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteOrderTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteOrderDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="destructive" onClick={handleDelete} loading={deleteLoading}>
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

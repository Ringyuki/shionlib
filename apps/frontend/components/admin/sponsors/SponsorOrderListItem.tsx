'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { cn } from '@/utils/cn'
import type { AdminSponsorOrderItem } from '@/interfaces/admin/sponsor.interface'

interface SponsorOrderListItemProps {
  order: AdminSponsorOrderItem
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

export function SponsorOrderListItem({ order }: SponsorOrderListItemProps) {
  const t = useTranslations('Admin.Sponsors')
  const locale = useLocale()

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

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        'bg-white/50 dark:bg-gray-900/50',
        'border-gray-200 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
    >
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
    </div>
  )
}

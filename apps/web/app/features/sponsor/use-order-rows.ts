import { useFormatter, useTranslations } from 'use-intl'
import { siteDay } from '~/shared/i18n/site-time'
import type { OrderView } from './sponsor'

export type OrderRow = {
  label: string
  value: string
  code?: boolean
}

export function useBadgeRow(): (until: Date | undefined) => OrderRow[] {
  const t = useTranslations('sponsor.summary')
  const format = useFormatter()
  return until =>
    until === undefined
      ? []
      : [
          {
            label: t('badge'),
            value: t('until', { date: format.dateTime(until, { dateStyle: 'long' }) }),
          },
        ]
}

export function useOrderRows() {
  const t = useTranslations('sponsor.summary')
  const format = useFormatter()
  const badge = useBadgeRow()
  return ({ order, badge_until: until }: OrderView, now: Date): OrderRow[] => {
    const deadline = order.expiresAt === null ? undefined : new Date(order.expiresAt)
    return [
      { label: t('number'), value: order.providerOrderId, code: true },
      ...badge(until === null ? undefined : new Date(until)),
      ...(deadline === undefined
        ? []
        : [
            {
              label: t('deadline'),
              value:
                siteDay(deadline) === siteDay(now)
                  ? t('todayAt', { time: format.dateTime(deadline, { timeStyle: 'short' }) })
                  : format.dateTime(deadline, { dateStyle: 'long', timeStyle: 'short' }),
            },
          ]),
    ]
  }
}

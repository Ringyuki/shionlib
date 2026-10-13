import { Card, cn, Divider, Heading, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { OrderRow } from '../use-order-rows'

type OrderSummaryProps = {
  rows: OrderRow[]
  total: string
  action?: ReactNode
  className?: string
}

export function OrderSummary({ rows, total, action, className }: OrderSummaryProps) {
  const t = useTranslations('sponsor.summary')
  return (
    <Card as="aside" aria-labelledby="order-summary" className={cn('self-start', className)}>
      <Stack gap="md">
        <Heading id="order-summary" level={2} size="md">
          {t('title')}
        </Heading>
        {rows.map(row => (
          <Inline key={row.label} gap="md" justify="between" align="baseline" wrap={false}>
            <Text size="sm" tone="muted" className="shrink-0">
              {row.label}
            </Text>
            <Text size="sm" className={cn('text-end break-all', row.code && 'font-mono text-xs')}>
              {row.value}
            </Text>
          </Inline>
        ))}
        <Stack gap="md" className="max-lg:hidden">
          <Divider />
          <Inline gap="md" justify="between" align="baseline" wrap={false}>
            <Text size="sm" weight="semibold">
              {t('due')}
            </Text>
            <Text weight="semibold" className="text-3xl tabular-nums">
              {total}
            </Text>
          </Inline>
          {action}
        </Stack>
      </Stack>
    </Card>
  )
}

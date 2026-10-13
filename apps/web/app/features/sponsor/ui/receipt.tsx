import { Card, CopyButton, Flex, Inline, Result, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { shownCard, sponsorPaths, type OrderView, type Self } from '../sponsor'
import { useBadgeRow } from '../use-order-rows'
import { useAmount, useMethodName } from '../use-sponsor-format'
import { SponsorCard } from './sponsor-card'

type ReceiptProps = {
  view: OrderView
  viewer: Self | null
}

const heading = { size: 'xs', tone: 'muted', weight: 'semibold' } as const

export function Receipt({ view, viewer }: ReceiptProps) {
  const { order, badge_until: until } = view
  const t = useTranslations('sponsor.done')
  const summary = useTranslations('sponsor.summary')
  const locale = useLocale()
  const format = useFormatter()
  const money = useAmount()
  const nameOf = useMethodName()
  const badgeRow = useBadgeRow()
  const card = shownCard(order, viewer)
  const rows = [
    { label: t('amount'), value: money(order.amount) },
    ...(order.paymentMethod === null
      ? []
      : [{ label: t('method'), value: nameOf(order.paymentMethod) }]),
    ...(order.paidAt === null
      ? []
      : [
          {
            label: t('paidAt'),
            value: format.dateTime(new Date(order.paidAt), {
              dateStyle: 'long',
              timeStyle: 'short',
            }),
          },
        ]),
    ...badgeRow(until === null ? undefined : new Date(until)),
  ]
  return (
    <Result status="success" size="lg" title={t('title')}>
      <Flex className="w-full flex-col justify-center gap-6 text-start sm:flex-row sm:items-start">
        {card !== undefined && (
          <Stack gap="sm" className="w-full sm:max-w-85">
            <Text {...heading}>{t('wall')}</Text>
            <SponsorCard card={card} />
          </Stack>
        )}
        <Stack gap="sm" className="w-full sm:max-w-80">
          <Text {...heading}>{t('receipt')}</Text>
          <Card padded={false}>
            <Stack gap="none" className="divide-line divide-y">
              <Inline gap="md" justify="between" align="center" wrap={false} className="px-4 py-2">
                <Text size="sm" tone="muted" className="shrink-0">
                  {summary('number')}
                </Text>
                <Inline gap="xs" align="center" wrap={false} className="min-w-0">
                  <Text className="font-mono text-xs break-all">{order.providerOrderId}</Text>
                  <CopyButton text={order.providerOrderId} label={t('copyNumber')} size="sm" />
                </Inline>
              </Inline>
              {rows.map(row => (
                <Inline
                  key={row.label}
                  gap="md"
                  justify="between"
                  align="baseline"
                  wrap={false}
                  className="px-4 py-3"
                >
                  <Text size="sm" tone="muted" className="shrink-0">
                    {row.label}
                  </Text>
                  <Text size="sm" className="text-end">
                    {row.value}
                  </Text>
                </Inline>
              ))}
            </Stack>
          </Card>
        </Stack>
      </Flex>
      <Inline gap="sm" justify="center" className="mt-6 w-full max-sm:flex-col">
        <Button asChild className="max-sm:w-full">
          <Link to={sponsorPaths(locale).wall}>{t('viewWall')}</Link>
        </Button>
        <Button asChild variant="outline" tone="neutral" className="max-sm:w-full">
          <Link to={sitePaths(locale).home}>{t('home')}</Link>
        </Button>
      </Inline>
    </Result>
  )
}

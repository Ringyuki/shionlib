import { Flex, Indicator, Inline, Stack, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { TrendPoint } from '../admin-stats'
import { useLineChart } from '../use-line-chart'

type TrendChartProps = {
  trends: TrendPoint[]
}

const tones = ['accent', 'warning'] as const

export function TrendChart({ trends }: TrendChartProps) {
  const t = useTranslations('admin.overview.site')
  const format = useFormatter()
  const lines = [
    { name: t('series.downloads'), values: trends.map(point => point.downloads) },
    { name: t('series.views'), values: trends.map(point => point.views) },
  ]
  const host = useLineChart(
    trends.map(point => format.dateTime(new Date(point.date), { month: 'short', day: 'numeric' })),
    lines,
  )
  return (
    <Stack gap="sm" className="min-w-0 flex-1">
      <Inline gap="md" align="center">
        <Text as="span" size="sm" weight="medium">
          {t('chart')}
        </Text>
        {lines.map((line, index) => (
          <Inline key={line.name} gap="xs" align="center" wrap={false}>
            <Indicator tone={tones[index]} size="sm" />
            <Text as="span" size="sm" tone="muted">
              {line.name}
            </Text>
          </Inline>
        ))}
      </Inline>
      <Flex ref={host} role="img" aria-label={t('chart')} className="min-h-52 w-full flex-1" />
    </Stack>
  )
}

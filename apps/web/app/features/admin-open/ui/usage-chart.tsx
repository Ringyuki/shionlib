import { Flex, Indicator, Inline, Stack, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { lineOption, useChart } from '~/features/admin'
import type { Day } from '../admin-open'

const tones = ['accent', 'warning'] as const

type UsageChartProps = {
  days: Day[]
  label: string
  className?: string
}

export function UsageChart({ days, label, className }: UsageChartProps) {
  const t = useTranslations('adminOpen.chart')
  const format = useFormatter()
  const lines = [
    { name: t('requests'), values: days.map(day => day.requests) },
    { name: t('throttled'), values: days.map(day => day.throttled) },
  ]
  const labels = days.map(day =>
    format.dateTime(new Date(`${day.day}T00:00:00Z`), {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
  )
  const host = useChart(palette => lineOption({ labels, lines, palette }))
  return (
    <Stack gap="sm" className="min-w-0">
      <Inline gap="md" align="center">
        {lines.map((line, index) => (
          <Inline key={line.name} gap="xs" align="center" wrap={false}>
            <Indicator tone={tones[index]} size="sm" />
            <Text as="span" size="sm" tone="muted">
              {line.name}
            </Text>
          </Inline>
        ))}
      </Inline>
      <Flex ref={host} role="img" aria-label={label} className={className ?? 'min-h-60 w-full'} />
    </Stack>
  )
}

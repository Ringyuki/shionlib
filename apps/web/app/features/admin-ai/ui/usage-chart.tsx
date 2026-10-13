import { Flex, Indicator, Inline, Panel, Stack, Text } from '@hina-ui/react'
import { barOption, useChart, type ChartBar } from '~/features/admin'

type UsageChartProps = {
  heading: string
  labels: string[]
  bars: ChartBar[]
  unit?: number
  format: (value: number) => string
  empty: string
}

export function UsageChart({ heading, labels, bars, unit, format, empty }: UsageChartProps) {
  const host = useChart(palette => barOption({ labels, bars, palette, unit, format }))
  return (
    <Panel title={heading}>
      <Stack gap="sm">
        <Inline gap="md" align="center" className="min-h-5">
          {bars.length === 0 && (
            <Text as="span" size="sm" tone="muted">
              {empty}
            </Text>
          )}
          {bars.map(bar => (
            <Inline key={bar.name} gap="xs" align="center" wrap={false}>
              <Indicator tone={bar.tone} size="sm" />
              <Text as="span" size="sm" tone="muted">
                {bar.name}
              </Text>
            </Inline>
          ))}
        </Inline>
        <Flex ref={host} role="img" aria-label={heading} className="h-44 w-full" />
      </Stack>
    </Panel>
  )
}

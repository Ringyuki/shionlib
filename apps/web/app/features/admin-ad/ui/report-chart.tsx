import { Flex } from '@hina-ui/react'
import { useFormatter } from 'use-intl'
import { barOption, useChart } from '~/features/admin'
import type { Report } from '../admin-ad'

type ReportChartProps = {
  report: Report
  name: string
  label: string
}

export function ReportChart({ report, name, label }: ReportChartProps) {
  const format = useFormatter()
  const days = report.days ?? []
  const labels = days.map(day =>
    format.dateTime(new Date(`${day.day}T00:00:00Z`), {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
  )
  const host = useChart(palette =>
    barOption({
      labels,
      bars: [{ name, values: days.map(day => day.views), tone: 'accent' }],
      palette,
      format: value => format.number(value),
    }),
  )
  return <Flex ref={host} role="img" aria-label={label} className="h-40 w-full" />
}

import { Grid, Inline, SegmentedControl, Stack, Statistic, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable } from '~/features/admin'
import { rangeDays, ranges, rateOf, type Range, type Report } from '../admin-ad'
import { usePercent } from '../use-percent'
import { ReportChart } from './report-chart'

type PaneReportProps = {
  report: Report
  days: Range
  onDays: (days: Range) => void
}

export function PaneReport({ report, days, onDays }: PaneReportProps) {
  const t = useTranslations('adminAd')
  const format = useFormatter()
  const percent = usePercent()
  const rate = (counts: Report['total']) => {
    const value = rateOf(counts)
    return value === undefined ? t('pane.noRate') : percent(value)
  }
  const count = rangeDays[days]
  return (
    <Stack as="section" gap="md" aria-label={t('pane.report')}>
      <Inline gap="md" align="center" className="justify-between">
        <Text as="span" size="sm" weight="medium" tone="muted">
          {t('pane.report')}
        </Text>
        <SegmentedControl
          size="sm"
          aria-label={t('pane.range')}
          value={days}
          options={ranges.map(range => ({
            value: range,
            label: t('pane.days', { days: rangeDays[range] }),
          }))}
          onValueChange={value => onDays(ranges.find(range => range === value) ?? days)}
        />
      </Inline>
      <Grid gap="md" className="grid-cols-3">
        <Statistic label={t('pane.views')} value={format.number(report.total.views)} />
        <Statistic label={t('pane.clicks')} value={format.number(report.total.clicks)} />
        <Statistic label={t('pane.rate')} value={rate(report.total)} />
      </Grid>
      <ReportChart
        report={report}
        name={t('pane.views')}
        label={t('pane.chart', { days: count })}
      />
      <RecordTable
        label={t('pane.slot')}
        rows={report.slots ?? []}
        rowKey={row => row.slot}
        columns={[
          { key: 'slot', label: t('pane.slot'), fill: true },
          { key: 'views', label: t('pane.views'), align: 'end' },
          { key: 'clicks', label: t('pane.clicks'), align: 'end' },
          { key: 'rate', label: t('pane.rate'), align: 'end' },
        ]}
        empty={t('pane.noData')}
        renderCell={(row, column) => (
          <Text as="span" size="sm" className={column === 'slot' ? undefined : 'tabular-nums'}>
            {column === 'slot'
              ? t(`slot.${row.slot}`)
              : column === 'rate'
                ? rate(row)
                : format.number(column === 'views' ? row.views : row.clicks)}
          </Text>
        )}
      />
    </Stack>
  )
}

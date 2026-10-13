import { Grid, Stack } from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { searchSet } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { costBars, requestBars, spansDays, type Overview } from '../admin-ai-overview'
import { useAiFormat } from '../use-ai-format'
import { FailuresPanel } from './failures-panel'
import { GatewayFrame } from './gateway-frame'
import { OverviewFigures } from './overview-figures'
import { ProvidersPanel, ScenesPanel } from './overview-tables'
import { RangePicker } from './range-picker'
import { UsageChart } from './usage-chart'

const costUnit = 0.0001

export function AiOverviewPage({ range, usage, series, scenes, providers, failures }: Overview) {
  const t = useTranslations('adminAi.overview')
  const format = useFormatter()
  const amounts = useAiFormat()
  const location = useLocation()
  const stay = useInPageNavigate()
  const labels = (series.buckets ?? []).map(bucket =>
    format.dateTime(
      new Date(bucket.at),
      spansDays(series)
        ? { month: 'short', day: 'numeric' }
        : { hour: '2-digit', minute: '2-digit' },
    ),
  )
  return (
    <GatewayFrame
      tab="overview"
      actions={
        <RangePicker
          value={range}
          onChange={picked =>
            stay({ search: searchSet(location.search, 'range', picked) }, { replace: true })
          }
        />
      }
    >
      <Stack gap="lg">
        <OverviewFigures usage={usage} range={range} />
        <Grid gap="none" className="items-start gap-6 xl:grid-cols-2">
          <UsageChart
            heading={t('requests.title')}
            labels={labels}
            bars={requestBars(series, { ok: t('requests.ok'), failed: t('requests.failed') })}
            format={amounts.count}
            empty=""
          />
          <UsageChart
            heading={t('costs.title')}
            labels={labels}
            bars={costBars(series, t('costs.others'))}
            unit={costUnit}
            format={amounts.price}
            empty={t('costs.empty')}
          />
        </Grid>
        <Grid gap="none" className="items-start gap-6 xl:grid-cols-2">
          <ScenesPanel scenes={scenes} />
          <ProvidersPanel providers={providers} />
        </Grid>
        <FailuresPanel failures={failures} scenes={scenes} range={range} />
      </Stack>
    </GatewayFrame>
  )
}

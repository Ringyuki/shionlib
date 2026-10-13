import { Flex, Grid, Panel, SegmentedControl, Statistic, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { trendRanges, type Overview, type TrendPoint, type TrendRange } from '../admin-stats'
import { TrendChart } from './trend-chart'

type SitePanelProps = {
  overview: Overview
  trends: TrendPoint[]
  days: TrendRange
}

export function SitePanel({ overview, trends, days }: SitePanelProps) {
  const t = useTranslations('admin.overview.site')
  const navigate = useInPageNavigate()
  const figures = [
    {
      label: t('games'),
      value: overview.totalGames,
      note: t('added', { count: overview.newGamesToday }),
    },
    {
      label: t('resources'),
      value: overview.totalResources,
      note: t('added', { count: overview.newResourcesToday }),
    },
    {
      label: t('users'),
      value: overview.totalUsers,
      note: t('added', { count: overview.newUsersToday }),
    },
    {
      label: t('comments'),
      value: overview.totalComments,
      note: t('added', { count: overview.newCommentsToday }),
    },
    {
      label: t('downloads'),
      value: overview.totalDownloads,
      note: t('today', { count: overview.downloadsToday }),
    },
    {
      label: t('views'),
      value: overview.totalViews,
      note: t('today', { count: overview.viewsToday }),
    },
  ]
  return (
    <Panel
      title={t('title')}
      actions={
        <SegmentedControl
          size="sm"
          aria-label={t('range')}
          value={days}
          options={trendRanges.map(range => ({ value: range, label: t('days', { count: range }) }))}
          onValueChange={range => navigate({ search: `?days=${range}` }, { replace: true })}
        />
      }
    >
      <Flex className="flex-col gap-8 lg:flex-row">
        <Grid gap="none" className="shrink-0 grid-cols-2 gap-x-4 gap-y-5 lg:w-75">
          {figures.map(figure => (
            <Statistic key={figure.label} label={figure.label} value={figure.value} size="sm">
              <Text as="span" size="sm" tone="muted" className="tabular-nums">
                {figure.note}
              </Text>
            </Statistic>
          ))}
        </Grid>
        <TrendChart trends={trends} />
      </Flex>
    </Panel>
  )
}

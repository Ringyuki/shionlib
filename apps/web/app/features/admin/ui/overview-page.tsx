import { Grid, PageHeader, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Pending } from '../admin'
import type { QueueEntry } from '../admin-queue'
import type { Overview, Storage, TrendPoint, TrendRange } from '../admin-stats'
import { PendingPanel } from './pending-panel'
import { SitePanel } from './site-panel'
import { StoragePanel } from './storage-panel'

type OverviewPageProps = {
  pending: Pending
  queue: QueueEntry[]
  overview: Overview
  trends: TrendPoint[]
  storage: Storage
  days: TrendRange
}

export function OverviewPage({
  pending,
  queue,
  overview,
  trends,
  storage,
  days,
}: OverviewPageProps) {
  const t = useTranslations('admin.overview')
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <PendingPanel queue={queue} pending={pending} />
      <Grid gap="none" className="items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21.25rem]">
        <SitePanel overview={overview} trends={trends} days={days} />
        <StoragePanel storage={storage} />
      </Grid>
    </Stack>
  )
}

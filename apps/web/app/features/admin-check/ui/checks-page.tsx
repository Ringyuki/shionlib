import { PageHeader, Stack } from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { pageSize } from '~/features/admin'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { searchOf, searchWith, type ScanCase } from '../admin-check'
import type { Listing } from '../admin-check.use-cases'
import { CasePane } from './case-pane'
import { RecordsPanel } from './records-panel'
import { StalledPanel } from './stalled-panel'
import { WaitingPanel } from './waiting-panel'

export function ChecksPage({ filter, waiting, stalled, records, total, opened }: Listing) {
  const t = useTranslations('adminCheck')
  const location = useLocation()
  const navigate = useInPageNavigate()
  const open = (scanCase: ScanCase) =>
    navigate({ search: searchWith(location.search, scanCase.id) })
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <WaitingPanel cases={waiting} onOpen={open} />
      <StalledPanel stalled={stalled} />
      <RecordsPanel
        records={records}
        paging={{ page: filter.page, pageSize, total }}
        outcome={filter.outcome}
        onOutcomeChange={outcome => navigate({ search: searchOf(outcome) })}
        onOpen={open}
      />
      <CasePane
        opened={opened}
        onClose={() => navigate({ search: searchWith(location.search, undefined) })}
      />
    </Stack>
  )
}

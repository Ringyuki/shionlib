import { Card, Chip, Inline, PageHeader, SegmentedControl, Select, Stack } from '@hina-ui/react'
import { useLocation } from 'react-router'
import { useMessages, useTranslations } from 'use-intl'
import { pageSize, usePending } from '~/features/admin'
import { labelOf } from '~/shared/i18n/labels'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import {
  narrowed,
  reasons,
  searchOf,
  searchWith,
  statusFilters,
  type Narrowing,
} from '../admin-report'
import type { Listing } from '../admin-report.use-cases'
import { ReportPane } from './report-pane'
import { ReportTable } from './report-table'

const everyReason = 'ALL'

export function ReportsPage({ filter, reports, total, opened }: Listing) {
  const t = useTranslations('adminReport')
  const labels = useMessages().resource.reason
  const waiting = usePending()?.reports ?? 0
  const location = useLocation()
  const navigate = useInPageNavigate()
  const show = (next: Partial<Narrowing>) => navigate({ search: searchOf({ ...filter, ...next }) })
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Card padded={false}>
        <Inline gap="sm" align="center" className="border-line border-b px-(--hn-panel-p) py-3">
          <SegmentedControl
            size="sm"
            aria-label={t('statusFilter')}
            value={filter.status}
            options={statusFilters.map(status => ({
              value: status,
              label:
                status === 'PENDING' && waiting > 0
                  ? t('pendingOf', { count: waiting })
                  : t(`status.${status}`),
            }))}
            onValueChange={value =>
              show({ status: statusFilters.find(status => status === value) ?? filter.status })
            }
          />
          <Select
            size="sm"
            aria-label={t('reasonFilter')}
            className="w-36"
            value={filter.reason ?? everyReason}
            options={[
              { value: everyReason, label: t('allReasons') },
              ...reasons.map(reason => ({ value: reason, label: labelOf(labels, reason) })),
            ]}
            onValueChange={value => show({ reason: reasons.find(reason => reason === value) })}
          />
          {filter.reporter !== undefined && (
            <Chip removable onRemove={() => show({ reporter: undefined })}>
              {t('byReporter', { name: reports[0]?.reporter.name ?? `#${filter.reporter}` })}
            </Chip>
          )}
          {filter.uploader !== undefined && (
            <Chip removable onRemove={() => show({ uploader: undefined })}>
              {t('againstUploader', {
                name: reports[0]?.reported_user.name ?? `#${filter.uploader}`,
              })}
            </Chip>
          )}
        </Inline>
        <ReportTable
          reports={reports}
          paging={{ page: filter.page, pageSize, total }}
          filtered={narrowed(filter)}
          onOpen={report => navigate({ search: searchWith(location.search, report.id) })}
        />
      </Card>
      <ReportPane
        opened={opened}
        onClose={() => navigate({ search: searchWith(location.search, undefined) })}
      />
    </Stack>
  )
}

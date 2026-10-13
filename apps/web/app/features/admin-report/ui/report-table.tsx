import { Text, Time } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import {
  RecordTable,
  TwoLines,
  UserRef,
  titleOf,
  type Paging,
  type RecordColumn,
} from '~/features/admin'
import { labelOf } from '~/shared/i18n/labels'
import type { Report } from '../admin-report'
import { ReportStatus } from './report-status'

type ReportTableProps = {
  reports: Report[]
  paging: Paging
  filtered: boolean
  onOpen: (report: Report) => void
}

export function fileOf(report: Pick<Report, 'resource'>): string {
  return report.resource.files?.[0]?.file_name ?? titleOf(report.resource.game)
}

export function ReportTable({ reports, paging, filtered, onOpen }: ReportTableProps) {
  const t = useTranslations('adminReport')
  const shared = useTranslations('admin')
  const reasons = useMessages().resource.reason
  const columns: RecordColumn[] = [
    { key: 'report', label: t('column.report'), fill: true },
    { key: 'resource', label: t('column.resource'), wide: true, className: 'w-[30%] min-w-56' },
    { key: 'reporter', label: t('column.reporter'), wide: true },
    { key: 'uploader', label: t('column.uploader'), wide: true },
    { key: 'time', label: t('column.time'), wide: true },
    { key: 'status', label: t('column.status') },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={reports}
      rowKey={report => report.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={onOpen}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(report, column) => {
        switch (column) {
          case 'report':
            return (
              <TwoLines
                first={labelOf(reasons, report.reason)}
                second={report.detail ?? undefined}
                narrow={t.rich('narrow', {
                  file: fileOf(report),
                  reporter: report.reporter.name,
                  time: () => <Time value={report.created} format="relative" tooltip={false} />,
                })}
              />
            )
          case 'resource':
            return <TwoLines first={fileOf(report)} second={titleOf(report.resource.game)} />
          case 'reporter':
            return <UserRef user={report.reporter} />
          case 'uploader':
            return <UserRef user={report.reported_user} />
          case 'time':
            return <Time value={report.created} format="relative" className="text-muted text-sm" />
          default:
            return <ReportStatus report={report} />
        }
      }}
    />
  )
}

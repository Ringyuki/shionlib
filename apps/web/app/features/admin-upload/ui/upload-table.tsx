import { Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, titleOf, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Filter, UploadItem } from '../admin-upload'
import { StageCell } from './upload-stage'

type UploadTableProps = {
  uploads: UploadItem[]
  paging: Paging
  filter: Filter
  filtered: boolean
  current: string | undefined
  onOpen: (upload: UploadItem) => void
}

const started = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } as const

export function keyOf(upload: Pick<UploadItem, 'kind' | 'id'>): string {
  return `${upload.kind}-${upload.id}`
}

export function UploadTable({
  uploads,
  paging,
  filter,
  filtered,
  current,
  onOpen,
}: UploadTableProps) {
  const t = useTranslations('adminUpload')
  const format = useFormatter()
  const bytes = useBytes('short')
  const columns: RecordColumn[] = [
    { key: 'file', label: t('column.file'), fill: true, minWidth: 280 },
    { key: 'uploader', label: t('column.uploader'), wide: true, className: 'w-36 min-w-36' },
    { key: 'stage', label: t('column.stage'), className: 'w-36 min-w-36' },
    { key: 'failures', label: t('column.failures'), align: 'end', wide: true },
    { key: 'started', label: t('column.started'), wide: true },
  ]
  const onlyUploading =
    filter.stage === 'uploading' &&
    filter.query === '' &&
    filter.user === undefined &&
    !filter.failed
  const empty = !filtered ? 'none' : onlyUploading ? 'uploading' : 'filtered'
  return (
    <RecordTable
      label={t('title')}
      rows={uploads}
      rowKey={keyOf}
      rowLabel={upload => upload.file_name}
      columns={columns}
      paging={paging}
      empty={t(`empty.${empty}`)}
      current={current}
      onOpen={onOpen}
      renderCell={(upload, column) => {
        switch (column) {
          case 'file':
            return (
              <TwoLines
                first={upload.file_name}
                second={t('fileFacts', {
                  size: bytes(upload.size),
                  where: upload.game === null ? t('unsubmitted') : titleOf(upload.game),
                })}
                narrow={upload.uploader.name}
              />
            )
          case 'uploader':
            return (
              <Text as="span" size="sm" truncate>
                {upload.uploader.name}
              </Text>
            )
          case 'stage':
            return <StageCell item={upload} />
          case 'failures':
            return upload.failure_count === 0 ? (
              <Text as="span" size="sm" tone="faint">
                —
              </Text>
            ) : (
              <Text as="span" size="sm" tone="danger" weight="medium" className="tabular-nums">
                {upload.failure_count}
              </Text>
            )
          default:
            return (
              <Text as="span" size="sm" className="tabular-nums">
                {format.dateTime(new Date(upload.started), started)}
              </Text>
            )
        }
      }}
    />
  )
}

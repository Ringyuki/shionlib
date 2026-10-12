import { Card } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { useAiFormat } from '~/features/admin-ai'
import type { Logged, LoggedDetail } from '../admin-ai-request'
import { RequestStatus } from './request-status'

type RequestAttemptsProps = {
  detail: LoggedDetail
  onOpen: (attempt: Logged) => void
}

export function RequestAttempts({ detail, onOpen }: RequestAttemptsProps) {
  const t = useTranslations('adminAiRequest.attempts')
  const format = useAiFormat()
  const columns: RecordColumn[] = [
    { key: 'route', label: t('route'), fill: true },
    { key: 'result', label: t('result') },
    { key: 'took', label: t('took'), align: 'end' },
  ]
  return (
    <Card padded={false} className="overflow-hidden">
      <RecordTable
        label={t('title')}
        rows={detail.attempts ?? []}
        rowKey={attempt => attempt.id}
        columns={columns}
        empty={t('empty')}
        onOpen={onOpen}
        current={detail.id}
        renderCell={(attempt, column) => {
          switch (column) {
            case 'route':
              return (
                <TwoLines
                  first={attempt.provider?.name ?? t('removedProvider')}
                  second={attempt.upstream_id}
                  mono
                />
              )
            case 'result':
              return <RequestStatus request={attempt} />
            default:
              return format.duration(attempt.duration_ms)
          }
        }}
      />
    </Card>
  )
}

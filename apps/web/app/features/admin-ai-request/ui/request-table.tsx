import { Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import { missing, useAiFormat, type Range, type SceneName } from '~/features/admin-ai'
import type { Logged } from '../admin-ai-request'
import { useRequestText } from '../use-request-text'
import { RequestStatus } from './request-status'

type RequestTableProps = {
  requests: Logged[]
  scenes: SceneName[]
  paging: Paging
  range: Range
  filtered: boolean
  onOpen: (request: Logged) => void
}

const clock = { hour: '2-digit', minute: '2-digit', second: '2-digit' } as const

const dated = { ...clock, month: 'numeric', day: 'numeric' } as const

const withinDay: readonly Range[] = ['1h', '24h']

export function RequestTable(props: RequestTableProps) {
  const { requests, scenes, paging, range, filtered, onOpen } = props
  const t = useTranslations('adminAiRequest')
  const shared = useTranslations('admin')
  const format = useFormatter()
  const amounts = useAiFormat()
  const text = useRequestText(scenes)
  const columns: RecordColumn[] = [
    { key: 'time', label: t('column.time') },
    { key: 'source', label: t('column.source'), wide: true },
    { key: 'model', label: t('column.model'), fill: true },
    { key: 'usage', label: t('column.usage'), wide: true },
    { key: 'cost', label: t('column.cost'), align: 'end', wide: true },
    { key: 'took', label: t('column.took'), wide: true },
    { key: 'status', label: t('column.status') },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={requests}
      rowKey={request => request.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={onOpen}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(request, column) => {
        switch (column) {
          case 'time':
            return (
              <Text as="span" size="sm" className="tabular-nums">
                {format.dateTime(
                  new Date(request.created),
                  withinDay.includes(range) ? clock : dated,
                )}
              </Text>
            )
          case 'source':
            return text.source(request)
          case 'model':
            return (
              <TwoLines
                first={request.model?.name ?? request.upstream_id}
                second={request.provider?.name}
                narrow={text.source(request)}
              />
            )
          case 'usage':
            return (
              <Text as="span" size="sm" tone="muted" className="tabular-nums">
                {text.usage(request) || missing}
              </Text>
            )
          case 'cost':
            return amounts.usdFine(request.cost_usd)
          case 'took':
            return (
              <Text as="span" size="sm" tone="muted" className="tabular-nums">
                {text.took(request)}
              </Text>
            )
          default:
            return <RequestStatus request={request} note={text.adaptation(request)} />
        }
      }}
    />
  )
}

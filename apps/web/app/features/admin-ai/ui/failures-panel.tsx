import { Link, Panel, Text, Time } from '@hina-ui/react'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { Link as RouterLink, useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { aiPaths, sceneLabel, type Range, type SceneName } from '../admin-ai'
import type { FailedCall } from '../admin-ai-overview'
import { missing } from '../use-ai-format'
import { ErrorTag } from './error-tag'

type FailuresPanelProps = {
  failures: FailedCall[]
  scenes: readonly SceneName[]
  range: Range
}

export function FailuresPanel({ failures, scenes, range }: FailuresPanelProps) {
  const t = useTranslations('adminAi.overview.failures')
  const navigate = useNavigate()
  const columns: RecordColumn[] = [
    { key: 'time', label: t('column.time') },
    { key: 'scene', label: t('column.scene'), wide: true },
    { key: 'model', label: t('column.model') },
    { key: 'kind', label: t('column.kind') },
    { key: 'message', label: t('column.message'), fill: true, wide: true },
  ]
  return (
    <Panel
      title={t('title')}
      padded={false}
      actions={
        <Link asChild className="inline-flex items-center gap-1 text-sm">
          <RouterLink to={aiPaths.requestsIn(range)} prefetch="intent">
            {t('all')}
            <ArrowRight aria-hidden className="size-4" />
          </RouterLink>
        </Link>
      }
    >
      <RecordTable
        label={t('title')}
        rows={failures}
        rowKey={request => request.id}
        columns={columns}
        empty={t('empty')}
        emptyIcon={<CircleCheck />}
        onOpen={request => void navigate(aiPaths.request(request.id, range))}
        renderCell={(request, column) => {
          switch (column) {
            case 'time':
              return <Time value={request.created} format="relative" className="text-sm" />
            case 'scene':
              return sceneLabel(request, scenes) ?? missing
            case 'model':
              return (
                <TwoLines
                  first={request.model?.name ?? request.upstream_id}
                  second={request.provider?.name}
                />
              )
            case 'kind':
              return <ErrorTag kind={request.error_kind ?? ''} />
            default:
              return (
                <Text as="span" size="sm" tone="muted" className="line-clamp-1 font-mono break-all">
                  {request.error_message}
                </Text>
              )
          }
        }}
      />
    </Panel>
  )
}

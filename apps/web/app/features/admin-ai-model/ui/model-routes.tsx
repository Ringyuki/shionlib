import { Panel } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { useAiFormat } from '~/features/admin-ai'
import {
  RouteActions,
  RouteDialogs,
  RoutePrice,
  RouteProtocol,
  RouteStatus,
  useRouteStatusText,
  type RouteAsk,
} from '~/features/admin-ai-route'
import { Button } from '~/shared/ui/button'
import type { Model, ProviderOption } from '../admin-ai-model'
import { useModelChange } from '../use-model-change'

type ModelRoutesProps = {
  model: Model
  providers: ProviderOption[]
  editable: boolean
  onAdd: () => void
}

export function ModelRoutes({ model, providers, editable, onAdd }: ModelRoutesProps) {
  const t = useTranslations('adminAiModel.routes')
  const format = useAiFormat()
  const statusText = useRouteStatusText()
  const [asked, setAsked] = useState<RouteAsk>()
  const reorder = useModelChange()
  const listed = model.routes ?? []
  const pending =
    reorder.pending && reorder.submitted?.action === 'reorder' ? reorder.submitted.ids : []
  const routes =
    pending.length === listed.length
      ? pending.flatMap(id => listed.filter(route => route.id === id))
      : listed
  const columns: RecordColumn[] = [
    { key: 'provider', label: t('column.provider'), fill: true },
    { key: 'protocol', label: t('column.protocol'), wide: true },
    { key: 'price', label: t('column.price'), wide: true },
    { key: 'status', label: t('column.status'), wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'actions', label: '' },
  ]
  return (
    <Panel
      title={t('title')}
      count={routes.length}
      description={t('hint')}
      padded={false}
      actions={
        <Button
          size="sm"
          variant="outline"
          tone="neutral"
          icon={<Plus />}
          disabled={!editable}
          onClick={onAdd}
        >
          {t('add')}
        </Button>
      }
    >
      <RecordTable
        label={t('title')}
        rows={routes}
        rowKey={route => route.id}
        rowLabel={route => route.provider.name}
        columns={columns}
        empty={t('empty')}
        onReorder={
          editable && routes.length > 1
            ? ordered =>
                void reorder.run({
                  action: 'reorder',
                  id: model.id,
                  ids: ordered.map(route => route.id),
                })
            : undefined
        }
        renderCell={(route, column) => {
          switch (column) {
            case 'provider':
              return (
                <TwoLines
                  first={route.provider.name}
                  second={route.upstream_id}
                  narrow={statusText(route)}
                  mono
                />
              )
            case 'protocol':
              return <RouteProtocol route={route} />
            case 'price':
              return <RoutePrice route={route} />
            case 'status':
              return <RouteStatus route={route} />
            case 'requests':
              return format.count(route.stats.requests)
            default:
              return (
                <RouteActions
                  route={route}
                  editable={editable}
                  onEdit={picked => setAsked({ kind: 'edit', route: picked })}
                  onRemove={picked => setAsked({ kind: 'remove', route: picked })}
                />
              )
          }
        }}
      />
      <RouteDialogs
        asked={asked}
        protocolsOf={route =>
          providers.find(provider => provider.id === route.provider.id)?.protocols
        }
        onClose={() => setAsked(undefined)}
      />
    </Panel>
  )
}

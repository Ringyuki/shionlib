import { Inline, Panel, Text } from '@hina-ui/react'
import { Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { useAiFormat } from '~/features/admin-ai'
import {
  RouteActions,
  RouteBatchBar,
  RouteDialogs,
  RoutePrice,
  RouteProtocol,
  RouteStatus,
  useRouteStatusText,
  type RouteAsk,
} from '~/features/admin-ai-route'
import { Button } from '~/shared/ui/button'
import type { ProviderDetail } from '../admin-ai-provider'

type ProviderRoutesProps = {
  provider: ProviderDetail
  editable: boolean
  onDiscover: () => void
  onAdd: () => void
}

export function ProviderRoutes({ provider, editable, onDiscover, onAdd }: ProviderRoutesProps) {
  const t = useTranslations('adminAiProvider.routes')
  const format = useAiFormat()
  const statusText = useRouteStatusText()
  const [asked, setAsked] = useState<RouteAsk>()
  const [selected, setSelected] = useState<number[]>([])
  const routes = provider.routes ?? []
  const chosen = selected.filter(id => routes.some(route => route.id === id))
  const columns: RecordColumn[] = [
    { key: 'model', label: t('column.model'), fill: true },
    { key: 'protocol', label: t('column.protocol'), wide: true },
    { key: 'price', label: t('column.price'), wide: true },
    { key: 'status', label: t('column.status'), wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'actions', label: '' },
  ]
  const tools = { size: 'sm', variant: 'outline', tone: 'neutral', disabled: !editable } as const
  return (
    <Panel
      title={t('title')}
      count={routes.length}
      padded={false}
      actions={
        <Inline gap="sm" align="center">
          <Button {...tools} icon={<RefreshCw />} onClick={onDiscover}>
            {t('discover')}
          </Button>
          <Button {...tools} icon={<Plus />} onClick={onAdd}>
            {t('add')}
          </Button>
        </Inline>
      }
    >
      {chosen.length > 0 && (
        <Inline gap="sm" align="center" className="border-line border-t px-(--hn-panel-p) py-3">
          <RouteBatchBar ids={chosen} onDone={() => setSelected([])} />
        </Inline>
      )}
      <RecordTable
        label={t('title')}
        rows={routes}
        rowKey={route => route.id}
        rowLabel={route => route.model.name}
        columns={columns}
        empty={t('empty')}
        selected={editable ? chosen : undefined}
        onSelectedChange={
          editable
            ? keys => setSelected(routes.map(route => route.id).filter(id => keys.includes(id)))
            : undefined
        }
        footer={
          <Text as="span" size="sm" tone="muted">
            {t('note')}
          </Text>
        }
        renderCell={(route, column) => {
          switch (column) {
            case 'model':
              return (
                <TwoLines
                  first={route.model.name}
                  second={route.upstream_id}
                  narrow={statusText(route)}
                  mono
                />
              )
            case 'protocol':
              return (
                <RouteProtocol route={route} protocols={provider.protocols} editable={editable} />
              )
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
        protocolsOf={() => provider.protocols}
        onClose={() => setAsked(undefined)}
      />
    </Panel>
  )
}

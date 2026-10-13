import { Switch, Time, toast } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import {
  aiPaths,
  errorKindOf,
  hostOf,
  missing,
  RoutesHealth,
  useAiFormat,
  useRoutesHealth,
} from '~/features/admin-ai'
import type { Provider } from '../admin-ai-provider'
import { useProviderChange } from '../use-provider-change'

type ProviderTableProps = {
  providers: Provider[]
  filtered: boolean
  editable: boolean
}

export function ProviderTable({ providers, filtered, editable }: ProviderTableProps) {
  const t = useTranslations('adminAiProvider')
  const shared = useTranslations('adminAi')
  const format = useAiFormat()
  const navigate = useNavigate()
  const health = useRoutesHealth()
  const change = useProviderChange()
  const toggled =
    change.submitted?.action === 'update' && change.pending ? change.submitted : undefined
  const columns: RecordColumn[] = [
    { key: 'provider', label: t('column.provider'), fill: true },
    { key: 'enabled', label: t('column.enabled') },
    { key: 'routes', label: t('column.routes'), wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'failureRate', label: t('column.failureRate'), align: 'end', wide: true },
    { key: 'firstToken', label: t('column.firstToken'), align: 'end', wide: true },
    { key: 'cost', label: t('column.cost'), align: 'end', wide: true },
    { key: 'lastUsed', label: t('column.lastUsed'), wide: true },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={providers}
      rowKey={provider => provider.id}
      columns={columns}
      empty={t('empty', { filtered: String(filtered) })}
      onOpen={provider => void navigate(aiPaths.provider(provider.id))}
      renderCell={(provider, column) => {
        switch (column) {
          case 'provider':
            return (
              <TwoLines
                first={provider.name}
                second={t('facts', {
                  kind: shared(`kind.${provider.kind}`),
                  host: hostOf(provider),
                })}
                narrow={health(provider.enabled, provider.route_counts).label}
              />
            )
          case 'enabled':
            return (
              <Switch
                aria-label={t('enable', { name: provider.name })}
                disabled={!editable || change.pending}
                checked={
                  toggled?.id === provider.id
                    ? (toggled.changes.enabled ?? provider.enabled)
                    : provider.enabled
                }
                onCheckedChange={async enabled => {
                  const outcome = await change.run({
                    action: 'update',
                    id: provider.id,
                    changes: { enabled },
                  })
                  if (outcome.ok) {
                    toast.success(t(enabled ? 'enabled' : 'disabled', { name: provider.name }))
                  }
                }}
              />
            )
          case 'routes':
            return (
              <RoutesHealth
                enabled={provider.enabled}
                counts={provider.route_counts}
                note={(provider.suspended_kinds ?? [])
                  .map(kind => shared(`errorKind.${errorKindOf(kind)}`))
                  .join(t('separator'))}
              />
            )
          case 'requests':
            return format.count(provider.stats.requests)
          case 'failureRate':
            return format.rate(provider.stats)
          case 'firstToken':
            return format.latency(provider.stats.first_token_ms)
          case 'cost':
            return format.usd(provider.stats.cost_usd)
          default:
            return provider.last_used_at === null ? (
              missing
            ) : (
              <Time
                value={provider.last_used_at}
                format="relative"
                className="text-muted text-sm"
              />
            )
        }
      }}
    />
  )
}

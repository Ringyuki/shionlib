import { Panel } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { aiPaths } from '../admin-ai'
import type { ProviderUsage, SceneUsage } from '../admin-ai-overview'
import { missing, useAiFormat } from '../use-ai-format'
import { RoutesHealth } from './status-line'

export function ScenesPanel({ scenes }: { scenes: SceneUsage[] }) {
  const t = useTranslations('adminAi.overview.scenes')
  const format = useAiFormat()
  const navigate = useNavigate()
  const columns: RecordColumn[] = [
    { key: 'scene', label: t('column.scene'), fill: true },
    { key: 'model', label: t('column.model'), wide: true },
    { key: 'requests', label: t('column.requests'), align: 'end' },
    { key: 'failureRate', label: t('column.failureRate'), align: 'end' },
    { key: 'cost', label: t('column.cost'), align: 'end', wide: true },
  ]
  return (
    <Panel title={t('title')} padded={false}>
      <RecordTable
        label={t('title')}
        rows={scenes}
        rowKey={scene => scene.key}
        columns={columns}
        empty={t('empty')}
        onOpen={() => void navigate(aiPaths.scenes)}
        renderCell={(scene, column) => {
          switch (column) {
            case 'scene':
              return <TwoLines first={scene.label} second={scene.key} mono />
            case 'model':
              return scene.model ?? missing
            case 'requests':
              return format.count(scene.stats.requests)
            case 'failureRate':
              return format.rate(scene.stats)
            default:
              return format.usd(scene.stats.cost_usd)
          }
        }}
      />
    </Panel>
  )
}

export function ProvidersPanel({ providers }: { providers: ProviderUsage[] }) {
  const t = useTranslations('adminAi.overview.providers')
  const format = useAiFormat()
  const navigate = useNavigate()
  const columns: RecordColumn[] = [
    { key: 'provider', label: t('column.provider'), fill: true },
    { key: 'routes', label: t('column.routes') },
    { key: 'requests', label: t('column.requests'), align: 'end', wide: true },
    { key: 'failureRate', label: t('column.failureRate'), align: 'end', wide: true },
    { key: 'firstToken', label: t('column.firstToken'), align: 'end', wide: true },
  ]
  return (
    <Panel title={t('title')} padded={false}>
      <RecordTable
        label={t('title')}
        rows={providers}
        rowKey={usage => usage.provider.id}
        columns={columns}
        empty={t('empty')}
        onOpen={usage => void navigate(aiPaths.provider(usage.provider.id))}
        renderCell={({ provider, host, stats }, column) => {
          switch (column) {
            case 'provider':
              return <TwoLines first={provider.name} second={host} />
            case 'routes':
              return <RoutesHealth enabled={provider.enabled} counts={provider.route_counts} />
            case 'requests':
              return format.count(stats.requests)
            case 'failureRate':
              return format.rate(stats)
            default:
              return format.latency(stats.first_token_ms)
          }
        }}
      />
    </Panel>
  )
}

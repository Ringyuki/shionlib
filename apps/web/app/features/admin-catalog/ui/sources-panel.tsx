import { Panel, Text, Time, toast, Tooltip } from '@hina-ui/react'
import { RefreshCw } from 'lucide-react'
import { useTranslations } from 'use-intl'
import {
  RecordTable,
  StatusLine,
  TwoLines,
  useSourceName,
  type RecordColumn,
} from '~/features/admin'
import { usePublicConfig } from '~/shared/config/public-config'
import { Button } from '~/shared/ui/button'
import { spanOf, stateOf, type Source } from '../admin-catalog'
import { useCatalogChange } from '../use-catalog-change'

const missing = '—'

const tones = { fine: 'success', failed: 'danger', never: 'neutral', manual: 'neutral' } as const

export function SourcesPanel({ sources }: { sources: Source[] }) {
  const t = useTranslations('adminCatalog')
  const { hikarinagiSiteUrl } = usePublicConfig()
  const change = useCatalogChange()
  const syncing =
    change.pending && change.submitted?.action === 'sync' ? change.submitted : undefined
  const sourceName = useSourceName()
  const refreshes = sources[0]?.refresh_seconds
  const columns: RecordColumn[] = [
    { key: 'source', label: t('sources.column.source'), fill: true },
    {
      key: 'kept',
      label: t('sources.column.kept'),
      wide: true,
      className: 'min-w-72 whitespace-nowrap',
    },
    { key: 'cursor', label: t('sources.column.cursor'), wide: true, className: 'min-w-40' },
    {
      key: 'pulled',
      label: t('sources.column.pulled'),
      wide: true,
      className: 'min-w-44 whitespace-nowrap',
    },
    { key: 'status', label: t('sources.column.status'), wide: true, className: 'min-w-28' },
    { key: 'action', label: '' },
  ]
  return (
    <Panel
      title={t('sources.title')}
      description={refreshes === undefined ? undefined : t('sources.hint', spanOf(refreshes))}
      padded={false}
    >
      <RecordTable
        label={t('sources.title')}
        rows={sources}
        rowKey={source => source.name}
        columns={columns}
        empty={t('sources.empty')}
        renderCell={(source, column) => {
          const state = stateOf(source)
          switch (column) {
            case 'source':
              return (
                <TwoLines
                  first={sourceName(source.name)}
                  second={source.name === 'hikarinagi' ? hikarinagiSiteUrl : undefined}
                  narrow={t('sources.narrow', {
                    games: source.games,
                    state: t(`sources.state.${state}`),
                  })}
                />
              )
            case 'kept':
              return (
                <TwoLines
                  first={t('sources.games', { count: source.games })}
                  second={t('sources.others', {
                    developers: source.developers,
                    characters: source.characters,
                  })}
                />
              )
            case 'cursor':
              return (
                <Text as="span" size="sm" className="font-mono">
                  {source.cursor === '' ? missing : source.cursor}
                </Text>
              )
            case 'pulled':
              return source.pulled_at === null ? (
                missing
              ) : (
                <TwoLines
                  first={<Time value={source.pulled_at} format="relative" />}
                  second={t('sources.changes', { count: source.changes })}
                />
              )
            case 'status':
              return (
                <Tooltip content={source.last_error ?? ''} disabled={state !== 'failed'}>
                  <StatusLine
                    tone={tones[state]}
                    label={t(`sources.state.${state}`)}
                    note={
                      state === 'failed' && source.failed_at !== null ? (
                        <Time value={source.failed_at} format="relative" tooltip={false} />
                      ) : undefined
                    }
                    alarming
                  />
                </Tooltip>
              )
            default:
              return (
                <Button
                  size="sm"
                  variant="outline"
                  tone="neutral"
                  icon={<RefreshCw />}
                  disabled={
                    !source.incremental || (change.pending && syncing?.source !== source.name)
                  }
                  loading={syncing?.source === source.name}
                  onClick={async () => {
                    const outcome = await change.run({ action: 'sync', source: source.name })
                    if (outcome.ok && outcome.result.kind === 'synced') {
                      toast.success(t('sources.synced', { count: outcome.result.changes }))
                    }
                  }}
                >
                  {t('sources.sync')}
                </Button>
              )
          }
        }}
      />
    </Panel>
  )
}

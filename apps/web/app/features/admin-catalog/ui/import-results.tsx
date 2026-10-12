import { Inline, Tag, Text, toast } from '@hina-ui/react'
import { Download, RefreshCw, Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { hitState, numbered, type Hit, type SearchState } from '../admin-catalog'
import type { Found } from '../admin-catalog.use-cases'
import { useCatalogChange } from '../use-catalog-change'

type ImportResultsProps = {
  found: Found | undefined
  state: SearchState
  onChanged: () => void
}

const icons = { absent: <Download />, here: <RefreshCw />, excluded: <Undo2 /> }

export function ImportResults({ found, state, onChanged }: ImportResultsProps) {
  const t = useTranslations('adminCatalog.import')
  const change = useCatalogChange()
  const rows = found?.hits ?? []
  const listed = rows.filter(hit => !numbered(hit)).length
  const bringing =
    change.pending && change.submitted?.action === 'import' ? change.submitted : undefined
  const bring = async (hit: Hit) => {
    if (found === undefined) {
      return
    }
    const outcome = await change.run({
      action: 'import',
      source: found.lookup.source,
      entity: found.lookup.entity,
      externalId: hit.external_id,
    })
    if (outcome.ok) {
      toast.success(t(`done.${hitState(hit)}`))
      onChanged()
    }
  }
  const columns: RecordColumn[] = [
    { key: 'entry', label: t('column.entry'), fill: true },
    { key: 'developer', label: t('column.developer'), wide: true, className: 'min-w-56' },
    { key: 'number', label: t('column.number'), wide: true, className: 'min-w-30' },
    { key: 'action', label: '' },
  ]
  return (
    <RecordTable
      label={t('results')}
      rows={rows}
      rowKey={hit => hit.external_id}
      columns={columns}
      empty={t(`empty.${state}`)}
      footer={
        found !== undefined && found.total > listed ? (
          <Text as="span" size="sm" tone="muted">
            {t('more', { shown: listed, total: found.total })}
          </Text>
        ) : undefined
      }
      renderCell={(hit, column) => {
        const state = hitState(hit)
        switch (column) {
          case 'entry':
            return (
              <TwoLines
                first={numbered(hit) ? t('byNumber', { id: hit.external_id }) : hit.title}
                second={hit.subtitle ?? undefined}
              />
            )
          case 'developer':
            return hit.developer ?? ''
          case 'number':
            return (
              <Text as="span" size="sm" className="font-mono">
                {hit.external_id}
              </Text>
            )
          default:
            return (
              <Inline gap="sm" align="center" justify="end" wrap={false}>
                {state !== 'absent' && (
                  <Tag tone={state === 'here' ? 'success' : 'neutral'}>{t(`state.${state}`)}</Tag>
                )}
                <Button
                  size="sm"
                  variant={state === 'absent' ? 'solid' : 'outline'}
                  tone={state === 'absent' ? 'accent' : 'neutral'}
                  icon={icons[state]}
                  loading={bringing?.externalId === hit.external_id}
                  disabled={change.pending}
                  onClick={() => void bring(hit)}
                >
                  {t(`action.${state}`)}
                </Button>
              </Inline>
            )
        }
      }}
    />
  )
}

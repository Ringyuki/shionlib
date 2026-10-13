import { Panel, Text, Time, toast } from '@hina-ui/react'
import { Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import type { Excluded } from '../admin-catalog'
import { useCatalogChange } from '../use-catalog-change'

type ExcludedPanelProps = {
  excluded: Excluded[]
  paging: Paging
}

const missing = '—'

export function ExcludedPanel({ excluded, paging }: ExcludedPanelProps) {
  const t = useTranslations('adminCatalog')
  const change = useCatalogChange()
  const restoring =
    change.pending && change.submitted?.action === 'import' ? change.submitted : undefined
  const keyOf = (entry: Excluded) => `${entry.source}:${entry.entity}:${entry.external_id}`
  const columns: RecordColumn[] = [
    { key: 'entry', label: t('excluded.column.entry'), fill: true },
    { key: 'number', label: t('excluded.column.number'), wide: true, className: 'min-w-30' },
    {
      key: 'by',
      label: t('excluded.column.by'),
      wide: true,
      className: 'min-w-34 whitespace-nowrap',
    },
    {
      key: 'at',
      label: t('excluded.column.at'),
      wide: true,
      className: 'min-w-34 whitespace-nowrap',
    },
    { key: 'action', label: '' },
  ]
  return (
    <Panel
      title={t('excluded.title')}
      count={paging.total}
      description={t('excluded.hint')}
      padded={false}
    >
      <RecordTable
        label={t('excluded.title')}
        rows={excluded}
        rowKey={keyOf}
        columns={columns}
        paging={paging}
        empty={t('excluded.empty')}
        renderCell={(entry, column) => {
          switch (column) {
            case 'entry':
              return (
                <TwoLines
                  first={entry.title ?? t('excluded.untitled')}
                  second={t(`entity.${entry.entity}`)}
                  narrow={entry.external_id}
                />
              )
            case 'number':
              return (
                <Text as="span" size="sm" className="font-mono">
                  {entry.external_id}
                </Text>
              )
            case 'by':
              return entry.excluded_by?.name ?? missing
            case 'at':
              return (
                <Time value={entry.excluded_at} format="relative" className="text-muted text-sm" />
              )
            default:
              return (
                <Button
                  size="sm"
                  variant="outline"
                  tone="neutral"
                  icon={<Undo2 />}
                  loading={
                    restoring?.externalId === entry.external_id && restoring.entity === entry.entity
                  }
                  disabled={change.pending}
                  onClick={async () => {
                    const outcome = await change.run({
                      action: 'import',
                      source: entry.source,
                      entity: entry.entity,
                      externalId: entry.external_id,
                    })
                    if (outcome.ok) {
                      toast.success(t('excluded.restored'))
                    }
                  }}
                >
                  {t('excluded.restore')}
                </Button>
              )
          }
        }}
      />
    </Panel>
  )
}

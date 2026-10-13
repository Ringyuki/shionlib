import { DataTable, Tag, type DataTableColumn } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { TwoLines } from '~/features/admin'
import { Capabilities, usePriceText } from '~/features/admin-ai'
import { placementOf, type Discovered } from '../admin-ai-provider'

type DiscoveryListProps = {
  models: Discovered[]
  selected: string[]
  onSelectedChange: (selected: string[]) => void
}

const virtualFrom = 60

const compact = { headerClass: 'whitespace-nowrap', cellClass: 'whitespace-nowrap' }

export function DiscoveryList({ models, selected, onSelectedChange }: DiscoveryListProps) {
  const t = useTranslations('adminAiProvider.discovery')
  const price = usePriceText()
  const columns: DataTableColumn<Discovered>[] = [
    { key: 'model', label: t('column.model'), cellClass: 'w-full' },
    { key: 'capabilities', label: t('column.capabilities'), ...compact },
    { key: 'price', label: t('column.price'), ...compact },
    { key: 'placement', label: t('column.placement'), ...compact },
  ]
  return (
    <DataTable
      label={t('title')}
      rows={models}
      columns={columns}
      rowKey={model => model.upstream_id}
      variant="secondary"
      maxHeight="24rem"
      stickyHeader
      virtualize={models.length > virtualFrom}
      emptyText={t('noMatch')}
      selectable={model => model.route_id === null}
      selected={selected}
      onSelectedChange={keys => onSelectedChange(keys.map(String))}
      renderCell={({ row, column }) => {
        switch (column.key) {
          case 'model':
            return <TwoLines first={row.name} second={row.upstream_id} mono />
          case 'capabilities':
            return <Capabilities of={row} />
          case 'price':
            return price(row.input_price, row.output_price)
          default: {
            const placement = placementOf(row)
            return (
              <Tag tone={placement === 'added' ? 'neutral' : 'accent'} variant="soft">
                {t(`placement.${placement}`)}
              </Tag>
            )
          }
        }
      }}
    />
  )
}

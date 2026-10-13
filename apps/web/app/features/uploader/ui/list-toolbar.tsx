import { Chip, Inline, SearchInput, Select } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { orderOf, orders, stages, type Listing, type Order, type Stage } from '../uploader'

type ListToolbarProps = {
  listing: Listing
  counts: Record<Stage, number>
  search: string
  onStageChange: (stage: Stage | undefined) => void
  onSearchChange: (search: string) => void
  onOrderChange: (order: Order) => void
}

export function ListToolbar({
  listing,
  counts,
  search,
  onStageChange,
  onSearchChange,
  onOrderChange,
}: ListToolbarProps) {
  const t = useTranslations('uploader.list')
  const format = useFormatter()
  return (
    <>
      <Inline gap="xs" role="group" aria-label={t('stageLabel')}>
        {stages.map(stage => (
          <Chip
            key={stage}
            selectable
            selected={listing.stage === stage}
            onSelectedChange={selected => onStageChange(selected ? stage : undefined)}
            className="tabular-nums"
          >
            {t('stage', { stage, count: format.number(counts[stage]) })}
          </Chip>
        ))}
      </Inline>
      <Inline gap="sm" align="center" justify="end" wrap={false} className="min-w-72 flex-1">
        <SearchInput
          size="sm"
          value={search}
          onValueChange={onSearchChange}
          placeholder={t('search')}
          aria-label={t('search')}
          className="max-w-64 min-w-40 flex-1"
        />
        {listing.stage !== 'uploading' && (
          <Select
            size="sm"
            aria-label={t('orderLabel')}
            value={orderOf(listing).name}
            onValueChange={value => {
              const chosen = orders.find(order => order.name === value)
              if (chosen !== undefined) {
                onOrderChange(chosen)
              }
            }}
            options={orders.map(order => ({ value: order.name, label: t(`order.${order.name}`) }))}
            className="w-44 shrink-0 max-sm:w-36"
          />
        )}
      </Inline>
    </>
  )
}

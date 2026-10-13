import { Button, Sheet } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { filterCount, noFilter, type FilterGroup, type ListFilter } from '../resource-listing'
import { ListFilters } from './list-filters'

type ListFilterSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: readonly FilterGroup[]
  filter: ListFilter
  total: number
  onChange: (filter: ListFilter) => void
}

export function ListFilterSheet({
  open,
  onOpenChange,
  groups,
  filter,
  total,
  onChange,
}: ListFilterSheetProps) {
  const t = useTranslations('resource.list')
  return (
    <Sheet
      title={t('filters')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <ListFilters stacked groups={groups} filter={filter} onChange={onChange} />
      )}
      renderFooter={({ close }) => (
        <>
          <Button
            variant="outline"
            tone="neutral"
            disabled={filterCount(filter) === 0}
            onClick={() => onChange(noFilter)}
          >
            {t('reset')}
          </Button>
          <Button onClick={close}>{t('done', { total })}</Button>
        </>
      )}
    />
  )
}

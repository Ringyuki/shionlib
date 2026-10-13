import { Badge, Button, Inline, Select } from '@hina-ui/react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'use-intl'
import {
  filterCount,
  listSorts,
  type FilterGroup,
  type ListFilter,
  type ListSort,
} from '../resource-listing'
import { ListFilters } from './list-filters'

type ListToolbarProps = {
  groups: readonly FilterGroup[]
  filter: ListFilter
  sort: ListSort
  onFilter: (filter: ListFilter) => void
  onSort: (sort: ListSort) => void
  onOpenFilters: () => void
}

export function ListToolbar({
  groups,
  filter,
  sort,
  onFilter,
  onSort,
  onOpenFilters,
}: ListToolbarProps) {
  const t = useTranslations('resource.list')
  return (
    <Inline gap="md" align="start" justify="between" wrap={false}>
      {groups.length > 0 && (
        <>
          <ListFilters
            groups={groups}
            filter={filter}
            onChange={onFilter}
            className="min-w-0 flex-1 max-sm:hidden"
          />
          <Badge content={filterCount(filter)} tone="accent" className="sm:hidden">
            <Button size="sm" variant="outline" tone="neutral" onClick={onOpenFilters}>
              <SlidersHorizontal aria-hidden />
              {t('filters')}
            </Button>
          </Badge>
        </>
      )}
      <Select
        size="sm"
        aria-label={t('sortBy')}
        value={sort}
        onValueChange={value => {
          const chosen = listSorts.find(name => name === value)
          if (chosen !== undefined) {
            onSort(chosen)
          }
        }}
        options={listSorts.map(name => ({ value: name, label: t(`sort.${name}`) }))}
        className="ms-auto w-42 shrink-0"
      />
    </Inline>
  )
}

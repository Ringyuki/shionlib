import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/shionui/Select'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowDownZA } from 'lucide-react'
import { SortBy, SortOrder } from './enums/Sort.enum'

interface SortProps {
  onSortByChange: (sortBy: SortBy) => void
  onSortOrderChange: (sortOrder: SortOrder) => void
  sortByValue?: SortBy
  sortOrderValue?: SortOrder
}

export const Sort = ({
  onSortByChange,
  onSortOrderChange,
  sortByValue,
  sortOrderValue,
}: SortProps) => {
  const t = useTranslations('Components.Game.Filter.Sort')
  const [sortBy, setSortBy] = useState<SortBy>(sortByValue ?? SortBy.RELEASE_DATE)
  const [sortOrder, setSortOrder] = useState<SortOrder>(sortOrderValue ?? SortOrder.DESC)

  const sortByOptions = Object.values(SortBy).map(value => ({
    label: t(`${value}`),
    value,
  }))
  const sortOrderOptions = Object.values(SortOrder).map(value => ({
    label: t(`${value}`),
    value,
  }))

  const handleSortByChange = (value: SortBy) => {
    setSortBy(value)
    onSortByChange(value)
  }
  const handleSortOrderChange = (value: SortOrder) => {
    setSortOrder(value)
    onSortOrderChange(value)
  }
  return (
    <div className="flex flex-col gap-2 max-w-full md:min-w-64">
      <div className="text-xs text-muted-foreground flex items-center gap-0.5">
        <ArrowDownZA className="size-3.5" />
        {t('sort')}
      </div>
      <div className="flex gap-2">
        <Select
          defaultValue={SortBy.RELEASE_DATE}
          value={sortBy}
          onValueChange={handleSortByChange}
        >
          <SelectTrigger className="text-base">
            <SelectValue placeholder={t('selectSort')} />
          </SelectTrigger>
          <SelectContent>
            <div className="flex flex-col gap-1">
              {sortByOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </div>
          </SelectContent>
        </Select>
        <Select
          defaultValue={SortOrder.DESC}
          value={sortOrder}
          onValueChange={handleSortOrderChange}
        >
          <SelectTrigger className="text-base">
            <SelectValue placeholder={t('selectOrder')} />
          </SelectTrigger>
          <SelectContent>
            <div className="flex flex-col gap-1">
              {sortOrderOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </div>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

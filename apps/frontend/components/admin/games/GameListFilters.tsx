'use client'

import { Input } from '@/components/shionui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

interface GameListFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: number | undefined
  onStatusChange: (value: number | undefined) => void
  sortBy: string
  onSortByChange: (value: string) => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
}

export function GameListFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: GameListFiltersProps) {
  const t = useTranslations('Admin.Games')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          prefix={<Search className="size-4" />}
        />
      </div>

      <Select
        value={status?.toString() ?? 'all'}
        onValueChange={v => onStatusChange(v === 'all' ? undefined : parseInt(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="1">{t('visible')}</SelectItem>
          <SelectItem value="2">{t('hidden')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="id">ID</SelectItem>
          <SelectItem value="title_jp">{t('gameTitle')}</SelectItem>
          <SelectItem value="views">{t('views')}</SelectItem>
          <SelectItem value="downloads">{t('downloads')}</SelectItem>
          <SelectItem value="created">{t('created')}</SelectItem>
          <SelectItem value="updated">{t('updated')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortOrder} onValueChange={v => onSortOrderChange(v as 'asc' | 'desc')}>
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">{t('desc')}</SelectItem>
          <SelectItem value="asc">{t('asc')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

'use client'

import { Input } from '@/components/shionui/Input'
import { InputNumber } from '@/components/shionui/InputNumber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { AdminWalkthroughStatus } from '@/interfaces/admin/walkthrough.interface'

interface WalkthroughListFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: AdminWalkthroughStatus | undefined
  onStatusChange: (value: AdminWalkthroughStatus | undefined) => void
  sortBy: string
  onSortByChange: (value: string) => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
  creatorId: number | undefined
  onCreatorIdChange: (value: number | undefined) => void
  gameId: number | undefined
  onGameIdChange: (value: number | undefined) => void
}

export function WalkthroughListFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  creatorId,
  onCreatorIdChange,
  gameId,
  onGameIdChange,
}: WalkthroughListFiltersProps) {
  const t = useTranslations('Admin.Walkthroughs')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
          prefix={<Search className="size-4" />}
        />
      </div>

      <InputNumber
        className="w-[140px]"
        value={creatorId ?? null}
        onChange={value => onCreatorIdChange(value ?? undefined)}
        placeholder={t('creatorId')}
        min={1}
        clampOnBlur
        showIncrement={false}
        showDecrement={false}
      />

      <InputNumber
        className="w-[140px]"
        value={gameId ?? null}
        onChange={value => onGameIdChange(value ?? undefined)}
        placeholder={t('gameId')}
        min={1}
        clampOnBlur
        showIncrement={false}
        showDecrement={false}
      />

      <Select
        value={status ?? 'all'}
        onValueChange={v => onStatusChange(v === 'all' ? undefined : (v as AdminWalkthroughStatus))}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="PUBLISHED">{t('published')}</SelectItem>
          <SelectItem value="DRAFT">{t('draft')}</SelectItem>
          <SelectItem value="HIDDEN">{t('hidden')}</SelectItem>
          <SelectItem value="DELETED">{t('deleted')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="id">ID</SelectItem>
          <SelectItem value="title">{t('title')}</SelectItem>
          <SelectItem value="created">{t('created')}</SelectItem>
          <SelectItem value="updated">{t('updated')}</SelectItem>
          <SelectItem value="status">{t('status')}</SelectItem>
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

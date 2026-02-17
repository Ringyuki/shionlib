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

interface UserListFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  role: number | undefined
  onRoleChange: (value: number | undefined) => void
  status: number | undefined
  onStatusChange: (value: number | undefined) => void
  sortBy: string
  onSortByChange: (value: string) => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (value: 'asc' | 'desc') => void
}

export function UserListFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: UserListFiltersProps) {
  const t = useTranslations('Admin.Users')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
          prefix={<Search className="size-4" />}
        />
      </div>

      <Select
        value={role?.toString() ?? 'all'}
        onValueChange={v => onRoleChange(v === 'all' ? undefined : parseInt(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('role')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allRoles')}</SelectItem>
          <SelectItem value="1">{t('roleUser')}</SelectItem>
          <SelectItem value="2">{t('roleAdmin')}</SelectItem>
          <SelectItem value="3">{t('roleSuperAdmin')}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={status?.toString() ?? 'all'}
        onValueChange={v => onStatusChange(v === 'all' ? undefined : parseInt(v))}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStatus')}</SelectItem>
          <SelectItem value="1">{t('active')}</SelectItem>
          <SelectItem value="2">{t('banned')}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={onSortByChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('sortBy')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="id">ID</SelectItem>
          <SelectItem value="name">{t('name')}</SelectItem>
          <SelectItem value="email">{t('email')}</SelectItem>
          <SelectItem value="role">{t('role')}</SelectItem>
          <SelectItem value="status">{t('status')}</SelectItem>
          <SelectItem value="created">{t('created')}</SelectItem>
          <SelectItem value="updated">{t('updated')}</SelectItem>
          <SelectItem value="last_login_at">{t('lastLogin')}</SelectItem>
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

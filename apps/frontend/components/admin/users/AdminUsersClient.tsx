'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'react-use'
import { useTranslations } from 'next-intl'
import { useAdminUserList } from '@/components/admin/hooks/useAdminUsers'
import { UserListFilters } from './UserListFilters'
import { UserList } from './UserList'
import { Pagination } from '@/components/common/content/Pagination'
import { Button } from '@/components/shionui/Button'
import { RotateCcw } from 'lucide-react'

interface AdminUsersClientProps {
  initialPage: number
  currentRole: number
  currentUserId: number
}

export function AdminUsersClient({
  initialPage,
  currentRole,
  currentUserId,
}: AdminUsersClientProps) {
  const t = useTranslations('Admin.Users')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useDebounce(() => setDebouncedSearch(search.trim()), 400, [search])

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      role,
      status,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, debouncedSearch, role, status, sortBy, sortOrder],
  )

  const { data, isLoading, refetch } = useAdminUserList(query)

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [debouncedSearch, role, status, sortBy, sortOrder])

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <UserListFilters
          search={search}
          onSearchChange={setSearch}
          role={role}
          onRoleChange={setRole}
          status={status}
          onStatusChange={setStatus}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
        />
        <Button
          intent="neutral"
          appearance="ghost"
          onClick={refetch}
          loading={isLoading}
          renderIcon={<RotateCcw className="size-4" />}
        >
          {t('refresh')}
        </Button>
      </div>
      <UserList
        items={data?.items}
        isLoading={isLoading}
        currentRole={currentRole}
        currentUserId={currentUserId}
        onRefresh={refetch}
      />

      <Pagination
        currentPage={data?.meta.currentPage ?? 1}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={isLoading}
        scrollToTop
        smoothScroll={false}
      />
    </div>
  )
}

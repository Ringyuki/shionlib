'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'react-use'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  useAdminGameList,
  updateGameStatus,
  deleteGame,
  addGameToRecentUpdate,
  removeGameFromRecentUpdate,
} from '@/components/admin/hooks/useAdminContent'
import { GameList } from './GameList'
import { GameListFilters } from './GameListFilters'
import { Button } from '@/components/shionui/Button'
import { Pagination } from '@/components/common/content/Pagination'

interface AdminGamesClientProps {
  initialPage: number
}

export function AdminGamesClient({ initialPage }: AdminGamesClientProps) {
  const t = useTranslations('Admin.Games')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useDebounce(() => setDebouncedSearch(search.trim()), 400, [search])

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, debouncedSearch, status, sortBy, sortOrder],
  )

  const { data, isLoading, refetch } = useAdminGameList(query)

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [debouncedSearch, status, sortBy, sortOrder])

  const handleStatusChange = async (gameId: number, newStatus: number) => {
    try {
      await updateGameStatus(gameId, newStatus)
      await refetch()
      toast.success(t('statusUpdated'))
    } catch {
      toast.error(t('statusUpdateFailed'))
    }
  }

  const handleDelete = async (gameId: number) => {
    try {
      await deleteGame(gameId)
      await refetch()
      toast.success(t('deleted'))
    } catch {
      toast.error(t('deleteFailed'))
    }
  }

  const handleAddRecentUpdate = async (gameId: number) => {
    try {
      await addGameToRecentUpdate(gameId)
      toast.success(t('recentUpdateAdded'))
    } catch {
      toast.error(t('recentUpdateUpdateFailed'))
    }
  }

  const handleRemoveRecentUpdate = async (gameId: number) => {
    try {
      await removeGameFromRecentUpdate(gameId)
      toast.success(t('recentUpdateRemoved'))
    } catch {
      toast.error(t('recentUpdateUpdateFailed'))
    }
  }

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GameListFilters
          search={search}
          onSearchChange={setSearch}
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

      <GameList
        items={data?.items}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onAddRecentUpdate={handleAddRecentUpdate}
        onRemoveRecentUpdate={handleRemoveRecentUpdate}
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

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'react-use'
import { useTranslations } from 'next-intl'
import { useAdminCommentList } from '@/components/admin/hooks/useAdminComments'
import { CommentListFilters } from './CommentListFilters'
import { CommentList } from './CommentList'
import { Pagination } from '@/components/common/content/Pagination'
import { Button } from '@/components/shionui/Button'
import { RotateCcw } from 'lucide-react'

interface AdminCommentsClientProps {
  initialPage: number
}

export function AdminCommentsClient({ initialPage }: AdminCommentsClientProps) {
  const t = useTranslations('Admin.Comments')
  const isFirstFilterSync = useRef(true)
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [creatorId, setCreatorId] = useState<number | undefined>(undefined)
  const [gameId, setGameId] = useState<number | undefined>(undefined)

  useDebounce(() => setDebouncedSearch(search.trim()), 400, [search])

  const query = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status,
      sortBy,
      sortOrder,
      creatorId,
      gameId,
    }),
    [page, pageSize, debouncedSearch, status, sortBy, sortOrder, creatorId, gameId],
  )

  const { data, isLoading, refetch } = useAdminCommentList(query)

  useEffect(() => {
    if (isFirstFilterSync.current) {
      isFirstFilterSync.current = false
      return
    }
    setPage(1)
  }, [debouncedSearch, status, sortBy, sortOrder, creatorId, gameId])

  const totalPages = data?.meta.totalPages ?? 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CommentListFilters
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={setStatus}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          creatorId={creatorId}
          onCreatorIdChange={setCreatorId}
          gameId={gameId}
          onGameIdChange={setGameId}
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

      <CommentList items={data?.items} isLoading={isLoading} onRefresh={refetch} />

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

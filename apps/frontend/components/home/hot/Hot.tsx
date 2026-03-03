'use client'

import { GameItem } from '@/interfaces/game/game.interface'
import { PaginatedMeta, PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { Head as GamesHead } from '@/components/home/games/Head'
import { Games } from '@/components/home/games/Games'
import { useCallback, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

interface HotProps {
  hotGames: GameItem[]
  content_limit: ContentLimit
  initialMeta: PaginatedMeta
}

const getData = async (page: number, pageSize: number) => {
  const { data } = await shionlibRequest().get<
    PaginatedResponse<GameItem, { content_limit: ContentLimit }>
  >(`/game/list`, {
    params: {
      'filter[sort_by]': 'hot_score',
      page,
      pageSize,
    },
  })
  return {
    games: data?.items ?? [],
    meta: data?.meta ?? {
      totalItems: 0,
      itemCount: 0,
      itemsPerPage: pageSize,
      totalPages: page,
      currentPage: page,
    },
  }
}

export const Hot = ({ hotGames, content_limit, initialMeta }: HotProps) => {
  const [games, setGames] = useState<GameItem[]>(hotGames)
  const [pageMeta, setPageMeta] = useState<PaginatedMeta>(initialMeta)
  const [loading, setLoading] = useState(false)
  const hasMore = pageMeta.currentPage < pageMeta.totalPages
  const pageSize = pageMeta.itemsPerPage

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading) return

    setLoading(true)
    try {
      const nextPage = pageMeta.currentPage + 1
      const { games, meta } = await getData(nextPage, pageSize)
      setGames(prev => [...prev, ...games])
      setPageMeta(meta)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [hasMore, loading, pageMeta.currentPage, pageSize])

  const setLastItemRef = useInfiniteScroll({
    hasMore,
    onLoadMore: handleLoadMore,
    rootMargin: '0px 0px 320px 0px',
  })

  return (
    <div className="flex flex-col gap-6">
      <GamesHead />
      <Games
        games={games}
        content_limit={content_limit}
        loading={loading && hasMore}
        skeletonCount={8}
        lastItemRef={hasMore ? setLastItemRef : undefined}
      />
    </div>
  )
}

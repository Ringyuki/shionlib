'use client'

import { useCallback, useMemo, useState } from 'react'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { PaginatedMeta, PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { ActivityCard } from './ActivityCard'
import { Masonry } from '@/components/common/shared/Masonry'
import { FileProgress } from './activities/FileProgress'
import { buildActivityFeed } from './activities/helpers/activity-feed.helper'
import { shionlibRequest } from '@/utils/request'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

interface ActivityProps {
  activities: ActivityInterface[]
  meta: PaginatedMeta & { content_limit: ContentLimit }
}

export const Activity = ({ activities: initialActivities, meta: initialMeta }: ActivityProps) => {
  const [activities, setActivities] = useState<ActivityInterface[]>(initialActivities)
  const [pageMeta, setPageMeta] = useState(initialMeta)
  const [loading, setLoading] = useState(false)

  const hasMore = pageMeta.currentPage < pageMeta.totalPages
  const pageSize = pageMeta.itemsPerPage

  const feedItems = useMemo(() => buildActivityFeed(activities), [activities])

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const nextPage = pageMeta.currentPage + 1
      const res = await shionlibRequest().get<
        PaginatedResponse<ActivityInterface, { content_limit: ContentLimit }>
      >('/activity/list', {
        params: {
          page: nextPage,
          pageSize,
        },
      })
      const nextItems = res.data?.items ?? []

      if (nextItems.length === 0) {
        setPageMeta(prev => ({
          ...prev,
          totalPages: prev.currentPage,
        }))
        return
      }

      setActivities(prev => [...prev, ...nextItems])

      if (res.data?.meta) {
        setPageMeta(res.data.meta)
      } else {
        setPageMeta(prev => ({
          ...prev,
          currentPage: nextPage,
          totalItems: prev.totalItems + nextItems.length,
          itemCount: prev.itemCount + nextItems.length,
        }))
      }
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
    <div className="flex flex-col gap-4">
      <Masonry columnCountBreakpoints={{ default: 1, sm: 2, md: 2, lg: 2 }}>
        {feedItems.map((item, index) => {
          const key = item.kind === 'file' ? `file-${item.fileKey}` : `activity-${item.activity.id}`
          return (
            <div
              key={key}
              ref={index === feedItems.length - 1 && hasMore ? setLastItemRef : undefined}
              className="break-inside-avoid"
            >
              {item.kind === 'file' ? (
                <FileProgress activities={item.activities} content_limit={pageMeta.content_limit} />
              ) : (
                <ActivityCard activity={item.activity} content_limit={pageMeta.content_limit} />
              )}
            </div>
          )
        })}
      </Masonry>
    </div>
  )
}

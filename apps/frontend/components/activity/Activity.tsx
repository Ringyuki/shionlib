'use client'

import { useCallback, useMemo, useState } from 'react'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
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

const getData = async (page: number, pageSize: number) => {
  const { data } = await shionlibRequest().get<
    PaginatedResponse<ActivityInterface, { content_limit: ContentLimit }>
  >('/activity/list', {
    params: {
      page,
      pageSize,
    },
  })
  return {
    items: data?.items ?? [],
    meta: data?.meta ?? {
      totalItems: 0,
      itemCount: 0,
      itemsPerPage: pageSize,
      totalPages: page,
      currentPage: page,
      content_limit: ContentLimit.NEVER_SHOW_NSFW_CONTENT,
    },
  }
}

export const Activity = ({ activities: initialActivities, meta: initialMeta }: ActivityProps) => {
  const {
    items: activities,
    setItems: setActivities,
    meta: pageMeta,
    setMeta: setPageMeta,
  } = useScrollRestoration<ActivityInterface, PaginatedMeta & { content_limit: ContentLimit }>({
    key: 'activity',
    initialItems: initialActivities,
    initialMeta,
  })
  const [loading, setLoading] = useState(false)

  const hasMore = pageMeta.currentPage < pageMeta.totalPages
  const pageSize = pageMeta.itemsPerPage

  const feedItems = useMemo(() => buildActivityFeed(activities), [activities])

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const nextPage = pageMeta.currentPage + 1
      const { items, meta } = await getData(nextPage, pageSize)

      setActivities(prev => [...prev, ...items])
      setPageMeta(meta)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [hasMore, loading, pageMeta.currentPage, pageSize, setActivities, setPageMeta])

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

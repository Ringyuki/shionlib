'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { buildActivityFeed } from '../activities/helpers/activity-feed.helper'
import {
  defaultActivityFeedCategory,
  type ActivityFeedCategory,
} from '../activities/constants/activity-feed'
import { ACTIVITY_CACHE_KEY } from '../constants/activity-page'
import {
  createInitialActivityBuckets,
  fetchActivityCategoryPage,
} from '../helpers/activity-feed-state'
import type { ActivityCacheState, ActivityMeta } from '../types/activity-feed'
import type { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'

interface UseActivityFeedOptions {
  initialActivities: ActivityInterface[]
  initialMeta: ActivityMeta
  initialCategory?: ActivityFeedCategory
}

export const useActivityFeed = ({
  initialActivities,
  initialMeta,
  initialCategory = defaultActivityFeedCategory,
}: UseActivityFeedOptions) => {
  const { meta: cacheState, setMeta: setCacheState } = useScrollRestoration<
    never,
    ActivityCacheState
  >({
    key: ACTIVITY_CACHE_KEY,
    initialItems: [],
    initialMeta: {
      activeCategory: initialCategory,
      buckets: createInitialActivityBuckets(initialCategory, initialActivities, initialMeta),
    },
  })
  const [loadingCategory, setLoadingCategory] = useState<ActivityFeedCategory | null>(null)
  const { activeCategory, buckets } = cacheState
  const activeBucket = buckets[activeCategory]
  const loading = loadingCategory === activeCategory
  const hasMore = activeBucket.meta.currentPage < activeBucket.meta.totalPages
  const feedItems = useMemo(() => buildActivityFeed(activeBucket.items), [activeBucket.items])

  const cacheStateRef = useRef(cacheState)
  cacheStateRef.current = cacheState

  const setActiveCategory = useCallback(
    (category: ActivityFeedCategory) => {
      setCacheState(prev => ({
        ...prev,
        activeCategory: category,
      }))
    },
    [setCacheState],
  )

  const loadCategoryPage = useCallback(
    async (category: ActivityFeedCategory, page: number, append: boolean) => {
      setLoadingCategory(category)
      try {
        const bucket = cacheStateRef.current.buckets[category]
        const { items, meta } = await fetchActivityCategoryPage(
          page,
          bucket.meta.itemsPerPage,
          category,
        )

        setCacheState(prev => ({
          ...prev,
          buckets: {
            ...prev.buckets,
            [category]: {
              items: append ? [...prev.buckets[category].items, ...items] : items,
              meta,
              initialized: true,
            },
          },
        }))
      } catch {
        if (!append) {
          setCacheState(prev => ({
            ...prev,
            buckets: {
              ...prev.buckets,
              [category]: {
                ...prev.buckets[category],
                initialized: true,
              },
            },
          }))
        }
      } finally {
        setLoadingCategory(current => (current === category ? null : current))
      }
    },
    [setCacheState],
  )

  useEffect(() => {
    if (activeBucket.initialized || loading) return
    void loadCategoryPage(activeCategory, 1, false)
  }, [activeBucket.initialized, activeCategory, loadCategoryPage, loading])

  const handleLoadMore = useCallback(async () => {
    if (loading || !hasMore) return
    await loadCategoryPage(activeCategory, activeBucket.meta.currentPage + 1, true)
  }, [activeBucket.meta.currentPage, activeCategory, hasMore, loadCategoryPage, loading])

  const { setTargetRef, isPaused, loadMore } = useInfiniteScroll({
    hasMore,
    onLoadMore: handleLoadMore,
    rootMargin: '0px 0px 320px 0px',
    autoLoadPages: 5,
    loadedPages: activeBucket.meta.currentPage - 1,
  })

  return {
    activeBucket,
    activeCategory,
    feedItems,
    hasMore,
    isPaused,
    loadMore,
    loading,
    setActiveCategory,
    setTargetRef,
  }
}

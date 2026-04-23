'use client'

import { ActivityCard } from './ActivityCard'
import { Masonry } from '@/components/common/shared/Masonry'
import { LoadMoreTrigger } from '@/components/common/shared/LoadMoreTrigger'
import { FileProgress } from './activities/FileProgress'
import { ActivityCategoryTabs } from './ActivityCategoryTabs'
import { ActivityLoadingSkeleton } from './ActivitySkeleton'
import { useActivityFeed } from './hooks/useActivityFeed'
import type { ActivityProps } from './types/activity-feed'

export const Activity = ({
  activities: initialActivities,
  meta: initialMeta,
  initialCategory,
}: ActivityProps) => {
  const {
    activeBucket,
    activeCategory,
    feedItems,
    hasMore,
    isPaused,
    loadMore,
    loading,
    setActiveCategory,
    setTargetRef,
  } = useActivityFeed({
    initialActivities,
    initialMeta,
    initialCategory,
  })

  return (
    <div className="flex flex-col gap-4">
      <ActivityCategoryTabs activeCategory={activeCategory} onChange={setActiveCategory} />

      {feedItems.length > 0 ? (
        <Masonry columnCountBreakpoints={{ default: 1, sm: 2, md: 2, lg: 2 }}>
          {feedItems.map((item, index) => {
            const key =
              item.kind === 'file' ? `file-${item.fileKey}` : `activity-${item.activity.id}`
            return (
              <div
                key={key}
                ref={index === feedItems.length - 1 && hasMore ? setTargetRef : undefined}
                className="break-inside-avoid"
              >
                {item.kind === 'file' ? (
                  <FileProgress
                    activities={item.activities}
                    content_limit={activeBucket.meta.content_limit}
                  />
                ) : (
                  <ActivityCard
                    activity={item.activity}
                    content_limit={activeBucket.meta.content_limit}
                  />
                )}
              </div>
            )
          })}
        </Masonry>
      ) : (
        <ActivityLoadingSkeleton category={activeCategory} />
      )}
      <LoadMoreTrigger
        isPaused={isPaused}
        hasMore={hasMore}
        loadMore={loadMore}
        loading={loading}
      />
    </div>
  )
}

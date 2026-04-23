import type { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import type { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import type { ContentLimit } from '@/interfaces/user/user.interface'
import type { ActivityFeedCategory } from '../activities/constants/activity-feed'

export interface ActivityProps {
  activities: ActivityInterface[]
  meta: ActivityMeta
  initialCategory?: ActivityFeedCategory
}

export type ActivityMeta = PaginatedMeta & { content_limit: ContentLimit }

export interface ActivityCategoryState {
  items: ActivityInterface[]
  meta: ActivityMeta
  initialized: boolean
}

export type ActivityBuckets = Record<ActivityFeedCategory, ActivityCategoryState>

export interface ActivityCacheState {
  activeCategory: ActivityFeedCategory
  buckets: ActivityBuckets
}

export interface ActivityCategoryPage {
  items: ActivityInterface[]
  meta: ActivityMeta
}

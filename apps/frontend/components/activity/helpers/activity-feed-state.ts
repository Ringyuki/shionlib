import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { shionlibRequest } from '@/utils/request'
import {
  activityFeedCategories,
  type ActivityFeedCategory,
} from '../activities/constants/activity-feed'
import type { ActivityBuckets, ActivityCategoryPage, ActivityMeta } from '../types/activity-feed'

const createActivityMeta = (
  page: number,
  pageSize: number,
  contentLimit: ContentLimit,
): ActivityMeta => ({
  totalItems: 0,
  itemCount: 0,
  itemsPerPage: pageSize,
  totalPages: page,
  currentPage: page,
  content_limit: contentLimit,
})

const createEmptyActivityCategoryState = (pageSize: number, contentLimit: ContentLimit) => ({
  items: [],
  meta: createActivityMeta(1, pageSize, contentLimit),
  initialized: false,
})

export const createInitialActivityBuckets = (
  initialCategory: ActivityFeedCategory,
  initialActivities: ActivityInterface[],
  initialMeta: ActivityMeta,
): ActivityBuckets =>
  Object.fromEntries(
    activityFeedCategories.map(category => [
      category.value,
      category.value === initialCategory
        ? {
            items: initialActivities,
            meta: initialMeta,
            initialized: true,
          }
        : createEmptyActivityCategoryState(initialMeta.itemsPerPage, initialMeta.content_limit),
    ]),
  ) as ActivityBuckets

export const fetchActivityCategoryPage = async (
  page: number,
  pageSize: number,
  category: ActivityFeedCategory,
): Promise<ActivityCategoryPage> => {
  const { data } = await shionlibRequest().get<
    PaginatedResponse<ActivityInterface, { content_limit: ContentLimit }>
  >('/activity/list', {
    params: {
      page,
      pageSize,
      category,
    },
  })

  return {
    items: data?.items ?? [],
    meta: data?.meta ?? createActivityMeta(page, pageSize, ContentLimit.NEVER_SHOW_NSFW_CONTENT),
  }
}

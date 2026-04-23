import { ActivityType } from '@/interfaces/activity/activity.interface'

export const fileActivityTypes = new Set<ActivityType>([
  ActivityType.FILE_UPLOAD_TO_SERVER,
  ActivityType.FILE_UPLOAD_TO_S3,
  ActivityType.FILE_CHECK_OK,
  ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED,
  ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED,
  ActivityType.FILE_CHECK_ENCRYPTED,
  ActivityType.FILE_CHECK_HARMFUL,
  ActivityType.FILE_REUPLOAD,
])

export const activityFeedCategories = [
  { value: 'comments' },
  { value: 'gameCreates' },
  { value: 'walkthroughCreates' },
  { value: 'edits' },
  { value: 'files' },
] as const

export type ActivityFeedCategory = (typeof activityFeedCategories)[number]['value']

export const defaultActivityFeedCategory: ActivityFeedCategory = 'comments'

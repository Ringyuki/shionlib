import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'
import { ActivityFeedItem } from '../types/activity-feed.type'
import { fileActivityTypes } from '../constants/activity-feed'

const buildFileKey = (activity: ActivityInterface) => {
  const fileId = activity.file?.id ?? 0
  const fileName = activity.file?.file_name ?? 'unknown-file'
  return `${fileId}-${fileName}`
}

export const buildActivityFeed = (activities: ActivityInterface[]): ActivityFeedItem[] => {
  const feed: ActivityFeedItem[] = []
  const fileBuckets = new Map<string, Extract<ActivityFeedItem, { kind: 'file' }>>()

  for (const activity of activities) {
    const fileId = activity.file?.id
    const fileKey = buildFileKey(activity)

    if (!activity.file || !fileActivityTypes.has(activity.type)) {
      feed.push({ kind: 'single', activity })
      continue
    }

    let bucket = fileBuckets.get(fileKey)
    if (!bucket) {
      bucket = { kind: 'file', fileKey, fileId, activities: [] }
      fileBuckets.set(fileKey, bucket)
      feed.push(bucket)
    }

    bucket.activities.push(activity)
  }

  return feed.filter(item => !(item.kind === 'single' && fileActivityTypes.has(item.activity.type)))
}

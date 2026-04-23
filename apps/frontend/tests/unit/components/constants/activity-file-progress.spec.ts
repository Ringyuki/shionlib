import { describe, expect, it } from 'vitest'
import { ActivityType } from '../../../../interfaces/activity/activity.interface'
import {
  activityFeedCategories,
  defaultActivityFeedCategory,
  fileActivityTypes,
} from '../../../../components/activity/activities/constants/activity-feed'
import {
  eventBadgeVariantMap,
  stageDefinitions,
  systemFileActivityTypes,
} from '../../../../components/activity/activities/constants/file-progress'

describe('components/home/activity/constants (unit)', () => {
  it('defines file activity type set', () => {
    expect(fileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_SERVER)).toBe(true)
    expect(fileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_S3)).toBe(true)
    expect(fileActivityTypes.has(ActivityType.FILE_REUPLOAD)).toBe(true)
  })

  it('orders activity feed categories by value', () => {
    expect(defaultActivityFeedCategory).toBe('comments')
    expect(activityFeedCategories.map(category => category.value)).toEqual([
      'comments',
      'gameCreates',
      'walkthroughCreates',
      'edits',
      'files',
    ])
  })

  it('defines stage progression and badge mappings', () => {
    expect(stageDefinitions.map(stage => stage.key)).toEqual(['uploadServer', 'scan', 'uploadS3'])
    expect(systemFileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_S3)).toBe(true)
    expect(eventBadgeVariantMap[ActivityType.FILE_CHECK_OK]).toBe('success')
    expect(eventBadgeVariantMap[ActivityType.FILE_CHECK_HARMFUL]).toBe('destructive')
  })
})

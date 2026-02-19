import { describe, expect, it } from 'vitest'
import { ActivityType } from '../../../../interfaces/activity/activity.interface'
import { fileActivityTypes } from '../../../../components/home/activity/activities/constants/activity-feed'
import {
  eventBadgeVariantMap,
  stageDefinitions,
  systemFileActivityTypes,
} from '../../../../components/home/activity/activities/constants/file-progress'

describe('components/home/activity/constants (unit)', () => {
  it('defines file activity type set', () => {
    expect(fileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_SERVER)).toBe(true)
    expect(fileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_S3)).toBe(true)
    expect(fileActivityTypes.has(ActivityType.FILE_REUPLOAD)).toBe(true)
  })

  it('defines stage progression and badge mappings', () => {
    expect(stageDefinitions.map(stage => stage.key)).toEqual(['uploadServer', 'scan', 'uploadS3'])
    expect(systemFileActivityTypes.has(ActivityType.FILE_UPLOAD_TO_S3)).toBe(true)
    expect(eventBadgeVariantMap[ActivityType.FILE_CHECK_OK]).toBe('success')
    expect(eventBadgeVariantMap[ActivityType.FILE_CHECK_HARMFUL]).toBe('destructive')
  })
})

import { describe, expect, it } from 'vitest'
import { ActivityType } from '../../../../interfaces/activity/activity.interface'
import {
  buildStageStates,
  getPrimaryStatus,
} from '../../../../components/home/activity/activities/helpers/file-progress.interface'

const activity = (type: ActivityType, created: string) =>
  ({
    type,
    created: new Date(created),
  }) as any

describe('components/home/activity/helpers/file-progress (unit)', () => {
  it('marks all stages completed and returns completed primary status', () => {
    const stages = buildStageStates([
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:01:00.000Z'),
      activity(ActivityType.FILE_CHECK_OK, '2026-01-01T00:02:00.000Z'),
      activity(ActivityType.FILE_UPLOAD_TO_S3, '2026-01-01T00:03:00.000Z'),
    ])

    expect(stages.every(stage => stage.completed)).toBe(true)
    expect(stages.some(stage => stage.failed)).toBe(false)
    expect(getPrimaryStatus(stages)).toEqual({
      variant: 'success',
      labelKey: 'status.completed',
    })
  })

  it('marks scan stage failed and returns failed primary status', () => {
    const stages = buildStageStates([
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:01:00.000Z'),
      activity(ActivityType.FILE_CHECK_HARMFUL, '2026-01-01T00:02:00.000Z'),
    ])

    expect(stages.some(stage => stage.failed)).toBe(true)
    expect(getPrimaryStatus(stages)).toEqual({
      variant: 'destructive',
      labelKey: 'status.failed',
    })
  })

  it('uses activities after latest reupload as relevant timeline', () => {
    const stages = buildStageStates([
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:01:00.000Z'),
      activity(ActivityType.FILE_CHECK_HARMFUL, '2026-01-01T00:02:00.000Z'),
      activity(ActivityType.FILE_REUPLOAD, '2026-01-01T00:03:00.000Z'),
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:04:00.000Z'),
      activity(ActivityType.FILE_CHECK_OK, '2026-01-01T00:05:00.000Z'),
    ])

    const scanStage = stages.find(stage => stage.key === 'scan')
    expect(scanStage?.failed).toBe(false)
    expect(scanStage?.completed).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { ActivityType } from '../../../../interfaces/activity/activity.interface'
import { buildActivityFeed } from '../../../../components/home/activity/activities/helpers/activity-feed.helper'

const activity = (type: ActivityType, created: string, file?: { id: number; file_name: string }) =>
  ({
    type,
    created: new Date(created),
    file,
  }) as any

describe('components/home/activity/helpers/activity-feed (unit)', () => {
  it('groups file activities by file key and keeps non-file activities as single', () => {
    const feed = buildActivityFeed([
      activity(ActivityType.COMMENT, '2026-01-01T00:00:00.000Z'),
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:01:00.000Z', {
        id: 1,
        file_name: 'a.zip',
      }),
      activity(ActivityType.FILE_CHECK_OK, '2026-01-01T00:02:00.000Z', {
        id: 1,
        file_name: 'a.zip',
      }),
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:03:00.000Z', {
        id: 2,
        file_name: 'b.zip',
      }),
    ])

    expect(feed).toHaveLength(3)
    expect(feed[0]).toEqual(expect.objectContaining({ kind: 'single' }))
    expect(feed[1]).toEqual(expect.objectContaining({ kind: 'file', fileKey: '1-a.zip' }))
    expect((feed[1] as any).activities).toHaveLength(2)
    expect(feed[2]).toEqual(expect.objectContaining({ kind: 'file', fileKey: '2-b.zip' }))
  })

  it('drops file-type activity that has no file payload', () => {
    const feed = buildActivityFeed([
      activity(ActivityType.FILE_UPLOAD_TO_SERVER, '2026-01-01T00:01:00.000Z'),
      activity(ActivityType.COMMENT, '2026-01-01T00:02:00.000Z'),
    ])

    expect(feed).toHaveLength(1)
    expect(feed[0]).toEqual(expect.objectContaining({ kind: 'single' }))
    expect((feed[0] as any).activity.type).toBe(ActivityType.COMMENT)
  })
})

import { ActivityType } from '@/interfaces/activity/activity.interface'
import { BadgeVariant } from '@/components/shionui/Badge'
import { StageDefinition } from '../interfaces/file-progress.interface'

export const stageDefinitions: StageDefinition[] = [
  {
    key: 'uploadServer',
    types: [ActivityType.FILE_UPLOAD_TO_SERVER, ActivityType.FILE_REUPLOAD],
  },
  {
    key: 'scan',
    types: [
      ActivityType.FILE_CHECK_OK,
      ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED,
      ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED,
      ActivityType.FILE_CHECK_ENCRYPTED,
      ActivityType.FILE_CHECK_HARMFUL,
    ],
  },
  {
    key: 'uploadS3',
    types: [ActivityType.FILE_UPLOAD_TO_S3],
  },
]

export const systemFileActivityTypes = new Set<ActivityType>([
  ActivityType.FILE_UPLOAD_TO_S3,
  ActivityType.FILE_CHECK_OK,
  ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED,
  ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED,
  ActivityType.FILE_CHECK_ENCRYPTED,
  ActivityType.FILE_CHECK_HARMFUL,
])

export const eventBadgeVariantMap: Partial<Record<ActivityType, BadgeVariant>> = {
  [ActivityType.FILE_UPLOAD_TO_SERVER]: 'info',
  [ActivityType.FILE_REUPLOAD]: 'info',
  [ActivityType.FILE_UPLOAD_TO_S3]: 'success',
  [ActivityType.FILE_CHECK_OK]: 'success',
  [ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED]: 'destructive',
  [ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED]: 'destructive',
  [ActivityType.FILE_CHECK_ENCRYPTED]: 'destructive',
  [ActivityType.FILE_CHECK_HARMFUL]: 'destructive',
}

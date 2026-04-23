import { ActivityType } from '../dto/create-activity.dto'

export enum ActivityListCategory {
  COMMENTS = 'comments',
  GAME_CREATES = 'gameCreates',
  WALKTHROUGH_CREATES = 'walkthroughCreates',
  EDITS = 'edits',
  FILES = 'files',
}

export const ActivityListCategoryTypes: Record<ActivityListCategory, ActivityType[]> = {
  [ActivityListCategory.COMMENTS]: [ActivityType.COMMENT],
  [ActivityListCategory.GAME_CREATES]: [ActivityType.GAME_CREATE],
  [ActivityListCategory.WALKTHROUGH_CREATES]: [ActivityType.WALKTHROUGH_CREATE],
  [ActivityListCategory.EDITS]: [
    ActivityType.GAME_EDIT,
    ActivityType.DEVELOPER_EDIT,
    ActivityType.CHARACTER_EDIT,
  ],
  [ActivityListCategory.FILES]: [
    ActivityType.FILE_UPLOAD_TO_SERVER,
    ActivityType.FILE_UPLOAD_TO_S3,
    ActivityType.FILE_REUPLOAD,
    ActivityType.FILE_CHECK_OK,
    ActivityType.FILE_CHECK_BROKEN_OR_TRUNCATED,
    ActivityType.FILE_CHECK_BROKEN_OR_UNSUPPORTED,
    ActivityType.FILE_CHECK_ENCRYPTED,
    ActivityType.FILE_CHECK_HARMFUL,
  ],
}

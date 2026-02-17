import { ArchiveStatus } from '../../security/enums/archive-status.enum'
import { ActivityFileCheckStatus } from '../../activity/dto/create-activity.dto'

export const LARGE_FILE_UPLOAD_QUEUE = 'large-file-upload'
export const S3_UPLOAD_JOB = 's3-upload'

export const FILE_CHECK_STATUS_MAP: Record<ArchiveStatus, keyof typeof ActivityFileCheckStatus> = {
  [ArchiveStatus.OK]: 'OK',
  [ArchiveStatus.BROKEN_OR_TRUNCATED]: 'BROKEN_OR_TRUNCATED',
  [ArchiveStatus.BROKEN_OR_UNSUPPORTED]: 'BROKEN_OR_UNSUPPORTED',
  [ArchiveStatus.ENCRYPTED]: 'ENCRYPTED',
  [ArchiveStatus.HARMFUL]: 'HARMFUL',
  [ArchiveStatus.HARMFUL_PENDING_REVIEW]: 'HARMFUL',
}

export const SMALL_FILE_UPLOAD_FILE_SIZE_HARD_LIMIT = 15 * 1024 * 1024 // 15MB
export const SMALL_FILE_UPLOAD_FILE_SIZE_SOFT_LIMIT = 5 * 1024 * 1024 // 5MB

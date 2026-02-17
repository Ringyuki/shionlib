export enum ActivityType {
  COMMENT = 'COMMENT',
  FILE_UPLOAD_TO_SERVER = 'FILE_UPLOAD_TO_SERVER',
  FILE_UPLOAD_TO_S3 = 'FILE_UPLOAD_TO_S3',
  FILE_REUPLOAD = 'FILE_REUPLOAD',
  FILE_CHECK_OK = 'FILE_CHECK_OK',
  FILE_CHECK_BROKEN_OR_TRUNCATED = 'FILE_CHECK_BROKEN_OR_TRUNCATED',
  FILE_CHECK_BROKEN_OR_UNSUPPORTED = 'FILE_CHECK_BROKEN_OR_UNSUPPORTED',
  FILE_CHECK_ENCRYPTED = 'FILE_CHECK_ENCRYPTED',
  FILE_CHECK_HARMFUL = 'FILE_CHECK_HARMFUL',
  GAME_CREATE = 'GAME_CREATE',
  GAME_EDIT = 'GAME_EDIT',
  DEVELOPER_EDIT = 'DEVELOPER_EDIT',
  CHARACTER_EDIT = 'CHARACTER_EDIT',
}

export enum ActivityFileStatus {
  PENDING = 1,
  UPLOADED_TO_SERVER = 2,
  UPLOADED_TO_S3 = 3,
}

export enum ActivityFileCheckStatus {
  PENDING = 0,
  OK = 1,
  BROKEN_OR_TRUNCATED = 2,
  BROKEN_OR_UNSUPPORTED = 3,
  ENCRYPTED = 4,
  HARMFUL = 5,
}

export interface Activity {
  id: number
  type: ActivityType
  user: {
    id: number
    name: string
    avatar: string
  }
  game?: {
    id: number
    title_jp: string
    title_zh: string
    title_en: string
  }
  comment?: {
    id: number
    html: string
  }
  developer?: {
    id: number
    name: string
  }
  character?: {
    id: number
    name_jp: string
    name_zh: string
    name_en: string
  }
  file?: {
    id: number
    file_name: string
    file_size: number
    file_status: ActivityFileStatus
    file_check_status: ActivityFileCheckStatus
  }
  created: Date
  updated: Date
}

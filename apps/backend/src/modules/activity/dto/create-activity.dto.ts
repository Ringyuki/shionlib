import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'
import { ivm, ivmEnum } from '../../../common/validation/i18n'

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

export class CreateActivityReqDto {
  @IsEnum(ActivityType, {
    message: ivmEnum('validation.common.IS_ENUM', ActivityType, { property: 'type' }),
  })
  type: ActivityType

  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'user_id' }) })
  user_id: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'comment_id' }) })
  comment_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'game_id' }) })
  game_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'edit_record_id' }) })
  edit_record_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'developer_id' }) })
  developer_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'character_id' }) })
  character_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'file_id' }) })
  file_id?: number

  @IsOptional()
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'file_size' }) })
  file_size?: number

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_name' }) })
  file_name?: string

  @IsOptional()
  @IsEnum(ActivityFileStatus, {
    message: ivmEnum('validation.common.IS_ENUM', ActivityFileStatus, { property: 'file_status' }),
  })
  file_status?: ActivityFileStatus

  @IsOptional()
  @IsEnum(ActivityFileCheckStatus, {
    message: ivmEnum('validation.common.IS_ENUM', ActivityFileCheckStatus, {
      property: 'file_check_status',
    }),
  })
  file_check_status?: ActivityFileCheckStatus
}

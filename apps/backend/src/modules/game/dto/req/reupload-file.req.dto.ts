import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class ReuploadFileReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'upload_session_id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'upload_session_id' }) })
  upload_session_id: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'reason' }) })
  @IsOptional()
  @MaxLength(500, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'reason', max: 500 }),
  })
  reason?: string
}

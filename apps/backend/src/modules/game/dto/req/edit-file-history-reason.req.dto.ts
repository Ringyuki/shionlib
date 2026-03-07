import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class EditFileHistoryReasonReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'reason' }) })
  @IsOptional()
  @MaxLength(500, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'reason', max: 500 }),
  })
  reason?: string
}

import { IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateBioReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'bio' }) })
  @MaxLength(500, { message: ivm('validation.common.MAX_LENGTH', { property: 'bio', max: 500 }) })
  bio: string
}

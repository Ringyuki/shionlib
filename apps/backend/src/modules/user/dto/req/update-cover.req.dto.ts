import { IsString, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateCoverReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'cover' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'cover' }) })
  cover: string
}

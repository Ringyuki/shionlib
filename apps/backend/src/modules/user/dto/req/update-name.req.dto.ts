import { IsString, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateNameReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }) })
  name: string
}

import { IsString, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdatePasswordReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'password' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'password' }) })
  password: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'old_password' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'old_password' }) })
  old_password: string
}

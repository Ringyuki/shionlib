import { IsNotEmpty, IsString } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class LoginDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'identifier' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'identifier' }) })
  identifier: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'password' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'password' }) })
  password: string
}

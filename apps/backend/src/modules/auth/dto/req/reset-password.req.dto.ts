import { IsString, IsNotEmpty, IsEmail, IsUUID } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class ResetPasswordReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'password' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'password' }) })
  password: string

  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  email: string

  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'token' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'token' }) })
  token: string
}

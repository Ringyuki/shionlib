import { IsEmail, IsUUID, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CheckForgetPasswordReqDto {
  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'token' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'token' }) })
  token: string

  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  email: string
}

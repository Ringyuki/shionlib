import { IsEmail, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class ForgetPasswordReqDto {
  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  email: string
}

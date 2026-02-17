import { IsEmail, IsNotEmpty } from 'class-validator'
import { ivm } from 'src/common/validation/i18n'

export class RequestCodeDto {
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  email: string
}

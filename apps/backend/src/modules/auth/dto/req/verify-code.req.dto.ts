import { IsString, IsNotEmpty, IsUUID, IsEmail } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class VerifyCodeDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'code' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'code' }) })
  code: string

  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  email: string

  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'uuid' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'uuid' }) })
  uuid: string
}

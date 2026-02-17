import { IsString, IsUUID, IsNotEmpty, IsEmail } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateEmailReqDto {
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'email' }) })
  @IsEmail({}, { message: ivm('validation.common.IS_EMAIL', { property: 'email' }) })
  email: string

  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'currentUuid' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'currentUuid' }) })
  currentUuid: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'currentCode' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'currentCode' }) })
  currentCode: string

  @IsUUID(4, { message: ivm('validation.common.IS_UUID', { property: 'newUuid' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'newUuid' }) })
  newUuid: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'newCode' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'newCode' }) })
  newCode: string
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class BindPotatoVNReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'pvn_user_name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'pvn_user_name' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'pvn_user_name', max: 255 }),
  })
  pvn_user_name: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'pvn_password' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'pvn_password' }) })
  pvn_password: string
}

import { IsString, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class RefreshTokenDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'refresh_token' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'refresh_token' }) })
  refresh_token: string
}

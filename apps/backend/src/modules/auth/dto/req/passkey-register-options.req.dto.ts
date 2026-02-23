import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class PasskeyRegisterOptionsReqDto {
  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @MaxLength(128, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 128 }) })
  name?: string
}

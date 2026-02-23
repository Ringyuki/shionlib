import { IsOptional, IsString } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class PasskeyLoginOptionsReqDto {
  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'identifier' }) })
  identifier?: string
}

import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class PasskeyRegisterVerifyReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'flow_id' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'flow_id' }) })
  flow_id: string

  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'response' }) })
  response: Record<string, unknown>

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @MaxLength(128, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 128 }) })
  name?: string
}

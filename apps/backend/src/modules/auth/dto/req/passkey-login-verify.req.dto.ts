import { IsNotEmpty, IsObject, IsString } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'

export class PasskeyLoginVerifyReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'flow_id' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'flow_id' }) })
  flow_id: string

  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'response' }) })
  response: AuthenticationResponseJSON
}

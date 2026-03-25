import { IsString, IsNotEmpty, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class PaySponsorOrderReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'method' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'method' }) })
  method: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'redirectUrl' }) })
  @IsOptional()
  redirectUrl?: string
}

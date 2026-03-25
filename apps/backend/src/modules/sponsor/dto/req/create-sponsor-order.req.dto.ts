import { IsNumber, IsBoolean, IsString, IsOptional, Min, Max, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CreateSponsorOrderReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'amount' }) },
  )
  @Min(1, { message: ivm('validation.common.MIN', { property: 'amount', min: 1 }) })
  @Max(10000, { message: ivm('validation.common.MAX', { property: 'amount', max: 10000 }) })
  amount: number

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'isPrivate' }) })
  @IsOptional()
  isPrivate?: boolean = false

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsOptional()
  @MaxLength(100, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 100 }) })
  name?: string = ''

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'message' }) })
  @IsOptional()
  @MaxLength(500, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'message', max: 500 }),
  })
  message?: string = ''
}

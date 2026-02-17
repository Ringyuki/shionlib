import { IsString, IsOptional, IsNumber, Min, Max, IsNotEmpty } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'

export class GetSuggestionsReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'prefix' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'prefix' }) })
  prefix: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'limit' }) },
  )
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: ivm('validation.common.MIN', { property: 'limit', min: 1 }) })
  @Max(50, { message: ivm('validation.common.MAX', { property: 'limit', max: 50 }) })
  limit?: number = 10
}

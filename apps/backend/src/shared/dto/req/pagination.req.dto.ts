import { IsNumber, IsOptional, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm } from '../../../common/validation/i18n'

export class PaginationReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'page' }) },
  )
  @IsOptional()
  @Type(() => Number)
  page: number = 1

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'pageSize' }) },
  )
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  pageSize: number = 10
}

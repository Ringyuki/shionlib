import { IsNumber, IsOptional, IsString, Min, Max, MaxLength, ValidateIf } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm } from '../../../../common/validation/i18n'

export class PartnerSummaryQueryReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'page' }) },
  )
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'pageSize' }) },
  )
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  pageSize: number = 200
}

export class PartnerVndbQueryReqDto {
  @ValidateIf(o => !o.b_id)
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @MaxLength(32)
  v_id?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsOptional()
  @MaxLength(32)
  b_id?: string
}

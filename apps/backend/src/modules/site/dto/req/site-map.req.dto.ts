import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { IsNumber, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm } from '../../../../common/validation/i18n'

export class SiteMapReqDto extends PaginationReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'pageSize' }) },
  )
  @Min(1, { message: ivm('validation.common.MIN', { property: 'pageSize', min: 1 }) })
  @Max(50000, { message: ivm('validation.common.MAX', { property: 'pageSize', max: 50000 }) })
  @IsOptional()
  @Type(() => Number)
  pageSize: number = 50000
}

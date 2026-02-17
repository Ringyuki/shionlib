import { IsString, IsOptional, IsNumber } from 'class-validator'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { ivm } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'

export class SearchGamesReqDto extends PaginationReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'q' }) })
  q: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'content_limit' }) },
  )
  @IsOptional()
  @Type(() => Number)
  content_limit?: number
}

export class SearchGameTagsReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'q' }) })
  q: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'limit' }) },
  )
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10
}

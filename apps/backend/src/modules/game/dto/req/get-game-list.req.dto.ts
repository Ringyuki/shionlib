import {
  IsNumber,
  IsInt,
  IsOptional,
  IsArray,
  IsString,
  ValidateNested,
  Min,
  Max,
  IsEnum,
  IsDate,
} from 'class-validator'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

enum SortBy {
  RELEASE_DATE = 'release_date',
  VIEWS = 'views',
  DOWNLOADS = 'downloads',
  HOT_SCORE = 'hot_score',
}
enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetGameListFilterReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'tags' }) })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'years' }) })
  @IsInt({ each: true, message: ivm('validation.common.IS_INT', { property: 'years' }) })
  @Type(() => Number)
  @Min(1900, {
    each: true,
    message: ivm('validation.common.MIN', { property: 'years', min: 1900 }),
  })
  @Max(2100, {
    each: true,
    message: ivm('validation.common.MAX', { property: 'years', max: 2100 }),
  })
  @IsOptional()
  years?: number[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'months' }) })
  @IsInt({ each: true, message: ivm('validation.common.IS_INT', { property: 'months' }) })
  @Type(() => Number)
  @Min(1, { each: true, message: ivm('validation.common.MIN', { property: 'months', min: 1 }) })
  @Max(12, { each: true, message: ivm('validation.common.MAX', { property: 'months', max: 12 }) })
  @IsOptional()
  months?: number[]

  @IsEnum(SortBy, {
    message: ivmEnum('validation.common.IS_ENUM', SortBy, { property: 'sort_by' }),
  })
  sort_by: SortBy = SortBy.RELEASE_DATE

  @IsEnum(SortOrder, {
    message: ivmEnum('validation.common.IS_ENUM', SortOrder, { property: 'sort_order' }),
  })
  sort_order: SortOrder = SortOrder.DESC

  @IsDate({ message: ivm('validation.common.IS_DATE', { property: 'start_date' }) })
  @IsOptional()
  @Type(() => Date)
  start_date?: Date

  @IsDate({ message: ivm('validation.common.IS_DATE', { property: 'end_date' }) })
  @IsOptional()
  @Type(() => Date)
  end_date?: Date
}

export class GetGameListReqDto extends PaginationReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'developer_id' }) },
  )
  @IsOptional()
  @Type(() => Number)
  developer_id?: number

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'character_id' }) },
  )
  @IsOptional()
  @Type(() => Number)
  character_id?: number

  @IsOptional()
  @ValidateNested()
  @Type(() => GetGameListFilterReqDto)
  filter?: GetGameListFilterReqDto
}

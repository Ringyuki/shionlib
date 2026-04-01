import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'
import { Transform } from 'class-transformer'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class GetAdListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsString()
  placement?: string

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsIn(['id', 'sort', 'created', 'updated'])
  sortBy?: string = 'id'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}

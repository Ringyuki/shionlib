import { IsOptional, IsInt, IsString, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class AdminGameListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['id', 'title_jp', 'views', 'downloads', 'created', 'updated'])
  sortBy?: string = 'id'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status?: number
}

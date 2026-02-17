import { IsOptional, IsString, IsIn, IsInt } from 'class-validator'
import { Type } from 'class-transformer'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class AdminCommentListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['id', 'created', 'updated', 'status'])
  sortBy?: string = 'created'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  status?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  creatorId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gameId?: number
}

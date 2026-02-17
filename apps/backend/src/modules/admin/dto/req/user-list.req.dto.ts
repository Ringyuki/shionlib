import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class AdminUserListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2, 3])
  role?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  status?: number

  @IsOptional()
  @IsIn(['id', 'name', 'email', 'role', 'status', 'created', 'updated', 'last_login_at'])
  sortBy?: string = 'id'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}

export class AdminUserSessionsReqDto extends PaginationReqDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  status?: number
}

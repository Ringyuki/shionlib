import { IsOptional, IsString, IsIn } from 'class-validator'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class AdminCharacterListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['id', 'name', 'created', 'updated'])
  sortBy?: string = 'id'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}

export class AdminDeveloperListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['id', 'name', 'created', 'updated'])
  sortBy?: string = 'id'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}

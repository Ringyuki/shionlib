import { IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { WalkthroughStatus } from '@prisma/client'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class AdminWalkthroughListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['id', 'title', 'created', 'updated', 'status'])
  sortBy?: string = 'created'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'

  @IsOptional()
  @IsEnum(WalkthroughStatus)
  status?: WalkthroughStatus

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  creatorId?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  gameId?: number
}

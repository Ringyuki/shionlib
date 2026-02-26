import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'
import { IsEnum, IsOptional } from 'class-validator'
import { WalkthroughStatus } from '@prisma/client'

export class GetWalkthroughListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsEnum(WalkthroughStatus)
  status?: WalkthroughStatus
}

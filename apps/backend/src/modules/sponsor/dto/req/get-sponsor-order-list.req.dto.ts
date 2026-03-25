import { IsEnum, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export enum SponsorOrderStatusFilter {
  NEW = 'NEW',
  DONE = 'DONE',
  EXPIRED = 'EXPIRED',
  REFUND = 'REFUND',
}

export class GetSponsorOrderListReqDto extends PaginationReqDto {
  @IsEnum(SponsorOrderStatusFilter, {
    message: ivm('validation.common.IS_ENUM', { property: 'status' }),
  })
  @IsOptional()
  status?: SponsorOrderStatusFilter
}

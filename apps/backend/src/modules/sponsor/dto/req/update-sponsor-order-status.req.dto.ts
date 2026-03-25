import { IsEnum } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export enum SponsorOrderStatusValue {
  NEW = 'NEW',
  DONE = 'DONE',
  EXPIRED = 'EXPIRED',
  REFUND = 'REFUND',
}

export class UpdateSponsorOrderStatusReqDto {
  @IsEnum(SponsorOrderStatusValue, {
    message: ivm('validation.common.IS_ENUM', { property: 'status' }),
  })
  status: SponsorOrderStatusValue
}

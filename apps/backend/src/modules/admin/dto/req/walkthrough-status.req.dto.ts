import { IsEnum } from 'class-validator'
import { WalkthroughStatus } from '@prisma/client'

export class AdminUpdateWalkthroughStatusReqDto {
  @IsEnum(WalkthroughStatus)
  status: WalkthroughStatus
}

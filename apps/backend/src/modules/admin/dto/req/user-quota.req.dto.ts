import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export enum AdminQuotaSizeAction {
  ADD = 'ADD',
  SUB = 'SUB',
}

export enum AdminQuotaUsedAction {
  USE = 'USE',
  ADD = 'ADD',
}

export class AdminAdjustQuotaSizeReqDto {
  @IsEnum(AdminQuotaSizeAction)
  action: AdminQuotaSizeAction

  @IsNumber()
  @Min(1)
  amount: number

  @IsOptional()
  @IsString()
  action_reason?: string
}

export class AdminAdjustQuotaUsedReqDto {
  @IsEnum(AdminQuotaUsedAction)
  action: AdminQuotaUsedAction

  @IsNumber()
  @Min(1)
  amount: number

  @IsOptional()
  @IsString()
  action_reason?: string
}

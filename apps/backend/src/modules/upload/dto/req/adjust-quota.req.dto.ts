import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export enum UserUploadQuotaUsedAmountRecordAction {
  ADD = 'ADD',
  USE = 'USE',
}

export enum UserUploadQuotaSizeRecordAction {
  ADD = 'ADD',
  SUB = 'SUB',
}

export class AdjustQuotaUsedAmountReqDto {
  @IsEnum(UserUploadQuotaUsedAmountRecordAction)
  action: UserUploadQuotaUsedAmountRecordAction

  @IsNumber()
  amount: number

  @IsNumber()
  @IsNotEmpty()
  upload_session_id: number

  @IsString()
  @IsOptional()
  action_reason: string
}

export class AdjustQuotaSizeAmountReqDto {
  @IsEnum(UserUploadQuotaSizeRecordAction)
  action: UserUploadQuotaSizeRecordAction

  @IsNumber()
  amount: number

  @IsString()
  @IsOptional()
  action_reason: string
}

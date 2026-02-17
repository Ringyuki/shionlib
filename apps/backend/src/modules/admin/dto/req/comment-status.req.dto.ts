import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'
import { ModerateCategoryKey } from '@prisma/client'

export class AdminUpdateCommentStatusReqDto {
  @IsIn([1, 2, 3])
  @Type(() => Number)
  status: number

  @IsOptional()
  @IsEnum(ModerateCategoryKey)
  top_category?: ModerateCategoryKey

  @IsOptional()
  @IsString()
  @MaxLength(2550)
  reason?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidence?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notify?: boolean
}

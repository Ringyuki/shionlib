import { Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { ReportMaliciousLevel } from '@prisma/client'

export enum GameDownloadSourceReportVerdict {
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export class ReviewGameDownloadSourceReportReqDto {
  @IsEnum(GameDownloadSourceReportVerdict)
  verdict: GameDownloadSourceReportVerdict

  @IsOptional()
  @IsEnum(ReportMaliciousLevel)
  malicious_level?: ReportMaliciousLevel

  @IsOptional()
  @IsString()
  @MaxLength(500)
  process_note?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notify?: boolean
}

import { Type } from 'class-transformer'
import { IsEnum, IsIn, IsNumber, IsOptional } from 'class-validator'
import {
  GameDownloadResourceReportReason,
  GameDownloadResourceReportStatus,
  ReportMaliciousLevel,
} from '@prisma/client'
import { PaginationReqDto } from '../../../../shared/dto/req/pagination.req.dto'

export class GetDownloadResourceReportListReqDto extends PaginationReqDto {
  @IsOptional()
  @IsEnum(GameDownloadResourceReportStatus)
  status?: GameDownloadResourceReportStatus

  @IsOptional()
  @IsEnum(GameDownloadResourceReportReason)
  reason?: GameDownloadResourceReportReason

  @IsOptional()
  @IsEnum(ReportMaliciousLevel)
  malicious_level?: ReportMaliciousLevel

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  resource_id?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  reporter_id?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  reported_user_id?: number

  @IsOptional()
  @IsIn(['id', 'created', 'updated', 'processed_at'])
  sortBy?: 'id' | 'created' | 'updated' | 'processed_at' = 'created'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc'
}

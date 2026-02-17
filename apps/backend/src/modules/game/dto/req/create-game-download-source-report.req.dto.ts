import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { GameDownloadResourceReportReason } from '@prisma/client'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

export class CreateGameDownloadSourceReportReqDto {
  @IsEnum(GameDownloadResourceReportReason, {
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadResourceReportReason, {
      property: 'reason',
    }),
  })
  reason: GameDownloadResourceReportReason

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'detail' }) })
  @MaxLength(500, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'detail', max: 500 }),
  })
  detail?: string
}

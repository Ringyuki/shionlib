import { IsDateString, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class AdminUpdateUserSponsorReqDto {
  @IsDateString(
    {},
    { message: ivm('validation.common.IS_DATE', { property: 'sponsor_expires_at' }) },
  )
  @IsOptional()
  sponsor_expires_at: string | null
}

import { IsNumber, IsString, MaxLength, IsOptional, IsBoolean, Min, Max } from 'class-validator'
import { ValidateIf } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class BanUserReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'banned_by' }) },
  )
  @IsOptional()
  banned_by?: number

  @IsOptional()
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'banned_reason' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'banned_reason', max: 255 }),
  })
  banned_reason?: string

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'banned_duration_days' }) },
  )
  @Max(999, {
    message: ivm('validation.common.MAX', { property: 'banned_duration_days', max: 999 }),
  })
  @Min(1, { message: ivm('validation.common.MIN', { property: 'banned_duration_days', min: 1 }) })
  @ValidateIf(o => o.is_permanent !== true, {
    message: ivm('validation.common.IS_NOT_EMPTY', { property: 'banned_duration_days' }),
  })
  banned_duration_days?: number

  @IsOptional()
  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'is_permanent' }) })
  is_permanent?: boolean

  @IsOptional()
  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'delete_user_content' }) })
  delete_user_comments?: boolean
}

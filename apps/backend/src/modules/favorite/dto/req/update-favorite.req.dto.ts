import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateFavoriteReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 255 }) })
  @IsOptional()
  name?: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'description' }) })
  @MaxLength(2000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'description', max: 2000 }),
  })
  @IsOptional()
  description?: string

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'is_private' }) })
  @IsOptional()
  is_private?: boolean
}

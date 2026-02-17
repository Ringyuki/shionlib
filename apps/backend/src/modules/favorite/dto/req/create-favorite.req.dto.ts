import { IsString, IsNotEmpty, IsOptional, MaxLength, IsBoolean } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CreateFavoriteReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'name' }) })
  @MaxLength(255, { message: ivm('validation.common.MAX_LENGTH', { property: 'name', max: 255 }) })
  name: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'description' }) })
  @MaxLength(2000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'description', max: 2000 }),
  })
  @IsOptional()
  description?: string

  @IsBoolean({ message: ivm('validation.common.IS_BOOLEAN', { property: 'is_private' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'is_private' }) })
  is_private: boolean
}

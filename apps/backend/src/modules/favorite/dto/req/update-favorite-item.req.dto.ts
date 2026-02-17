import { IsString, IsOptional, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class UpdateFavoriteItemReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @MaxLength(2000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'note', max: 2000 }),
  })
  @IsOptional()
  note?: string
}

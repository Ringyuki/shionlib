import { IsNotEmpty, IsNumber, IsString, IsOptional, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class CreateFavoriteItemReqDto {
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'game_id' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'game_id' }) })
  game_id: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @MaxLength(2000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'note', max: 2000 }),
  })
  @IsOptional()
  note?: string
}

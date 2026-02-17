import { IsNotEmpty, IsNumber } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'

export class GetGameReqDto {
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  @Type(() => Number)
  id: number
}

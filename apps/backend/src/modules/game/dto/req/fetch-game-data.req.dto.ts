import { IsNotEmpty, IsString, IsOptional } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class FetchGameDataReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'b_id' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'b_id' }) })
  b_id: string

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'v_id' }) })
  @IsOptional()
  v_id?: string
}

import { IsString, MaxLength } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'

export class GetAdsByPlacementReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'placement' }) })
  @MaxLength(100)
  placement: string
}

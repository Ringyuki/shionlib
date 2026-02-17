import { IsNotEmpty, IsOptional, IsNumber, IsObject } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm } from '../../../../common/validation/i18n'

export class CreateCommentReqDto {
  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'content' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'content' }) })
  @Type(() => Object)
  content: Record<string, any>

  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'parent_id' }) })
  @IsOptional()
  parent_id?: number
}

import { IsNotEmpty, IsObject } from 'class-validator'
import { ivm } from '../../../../common/validation/i18n'
import { Type } from 'class-transformer'

export class EditCommentReqDto {
  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'content' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'content' }) })
  @Type(() => Object)
  content: Record<string, any>
}

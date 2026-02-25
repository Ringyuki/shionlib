import { IsNotEmpty, IsObject } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm } from '../../../../common/validation/i18n'
import { MaxEditorLength } from '../../../../common/validation/max-editor-length.decorator'

export class EditCommentReqDto {
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'content' }) })
  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'content' }) })
  @MaxEditorLength(10000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'content', max: 10000 }),
  })
  @Type(() => Object)
  content: Record<string, any>
}

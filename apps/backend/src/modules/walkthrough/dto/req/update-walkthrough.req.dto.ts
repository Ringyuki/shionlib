import { IsNotEmpty, IsString, IsObject, IsEnum } from 'class-validator'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import { MaxEditorLength } from '../../../../common/validation/max-editor-length.decorator'
import { WalkthroughStatus } from './create-walkthrough.req.dto'

export class UpdateWalkthroughReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'title' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'title' }) })
  title: string

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'content' }) })
  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'content' }) })
  @MaxEditorLength(50000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'content', max: 50000 }),
  })
  content: Record<string, any>

  @IsEnum(WalkthroughStatus, {
    message: ivmEnum('validation.common.IS_ENUM', WalkthroughStatus, { property: 'status' }),
  })
  status: WalkthroughStatus
}

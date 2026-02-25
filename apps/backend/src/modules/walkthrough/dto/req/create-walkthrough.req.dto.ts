import { IsNotEmpty, IsString, IsNumber, IsObject, IsEnum } from 'class-validator'
import { Type } from 'class-transformer'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import { MaxEditorLength } from '../../../../common/validation/max-editor-length.decorator'

export enum WalkthroughStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

export class CreateWalkthroughReqDto {
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'game_id' }) })
  @IsNumber({}, { message: ivm('validation.common.IS_NUMBER', { property: 'game_id' }) })
  @Type(() => Number)
  game_id: number

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'title' }) })
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'title' }) })
  title: string

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'content' }) })
  @IsObject({ message: ivm('validation.common.IS_OBJECT', { property: 'content' }) })
  @MaxEditorLength(50000, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'content', max: 50000 }),
  })
  @Type(() => Object)
  content: Record<string, any>

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'status' }) })
  @IsEnum(WalkthroughStatus, {
    message: ivmEnum('validation.common.IS_ENUM', WalkthroughStatus, { property: 'status' }),
  })
  status: WalkthroughStatus
}

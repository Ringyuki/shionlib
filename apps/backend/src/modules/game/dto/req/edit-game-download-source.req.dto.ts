import { IsArray, IsEnum, IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'
import {
  GameDownloadSourcePlatform,
  GameDownloadSourceLanguage,
} from './create-game-download-source.req.dto'

export class EditGameDownloadSourceReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_name' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'file_name', max: 255 }),
  })
  @IsOptional()
  file_name?: string

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'platform' }) })
  @IsEnum(GameDownloadSourcePlatform, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourcePlatform, {
      property: 'platform',
    }),
  })
  platform: GameDownloadSourcePlatform[]

  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'id' }) })
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'language' }) })
  @IsEnum(GameDownloadSourceLanguage, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourceLanguage, {
      property: 'language',
    }),
  })
  language: GameDownloadSourceLanguage[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @IsOptional()
  note?: string
}

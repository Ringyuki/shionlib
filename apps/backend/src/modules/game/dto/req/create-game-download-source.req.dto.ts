import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsNumber,
  MaxLength,
} from 'class-validator'
import { ivm, ivmEnum } from '../../../../common/validation/i18n'

export enum GameDownloadSourcePlatform {
  WINDOWS = 'win',
  IOS = 'ios',
  ANDROID = 'and',
  LINUX = 'lin',
  PS3 = 'ps3',
  PS4 = 'ps4',
  PSV = 'psv',
  PSP = 'psp',
  SWITCH = 'swi',
  DVD = 'dvd',
}

export enum GameDownloadSourceLanguage {
  EN = 'en',
  ZH = 'zh',
  ZH_HANT = 'zh-hant',
  JP = 'jp',
}

export class CreateGameDownloadSourceReqDto {
  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'file_name' }) })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'file_name' }) })
  @MaxLength(255, {
    message: ivm('validation.common.MAX_LENGTH', { property: 'file_name', max: 255 }),
  })
  file_name: string

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'platform' }) })
  @IsEnum(GameDownloadSourcePlatform, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourcePlatform, {
      property: 'platform',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'platform' }) })
  platform: GameDownloadSourcePlatform[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'language' }) })
  @IsEnum(GameDownloadSourceLanguage, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourceLanguage, {
      property: 'language',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'language' }) })
  language: GameDownloadSourceLanguage[]

  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: ivm('validation.common.IS_NUMBER', { property: 'upload_session_id' }) },
  )
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'upload_session_id' }) })
  upload_session_id: number

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @IsOptional()
  note?: string
}

export class MigrateCreateGameDownloadSourceReqDto {
  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'platform' }) })
  @IsEnum(GameDownloadSourcePlatform, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourcePlatform, {
      property: 'platform',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'platform' }) })
  platform: GameDownloadSourcePlatform[]

  @IsArray({ message: ivm('validation.common.IS_ARRAY', { property: 'language' }) })
  @IsEnum(GameDownloadSourceLanguage, {
    each: true,
    message: ivmEnum('validation.common.IS_ENUM', GameDownloadSourceLanguage, {
      property: 'language',
    }),
  })
  @IsNotEmpty({ message: ivm('validation.common.IS_NOT_EMPTY', { property: 'language' }) })
  language: GameDownloadSourceLanguage[]

  @IsString({ message: ivm('validation.common.IS_STRING', { property: 'note' }) })
  @IsOptional()
  note?: string
}
